const fetch = require("node-fetch");

// Function to determine if a prompt likely needs web search
function shouldPerformWebSearch(prompt) {
  // Get the last line of the prompt (the actual question)
  const actualQuestion = prompt.split('\n').pop() || prompt;
  
  const searchIndicators = [
    "search",
    "find",
    "look up",
    "what is",
    "tell me about",
    "current",
    "latest",
    "news",
    "recent"
  ];
  
  return searchIndicators.some(indicator => 
    actualQuestion.toLowerCase().includes(indicator.toLowerCase())
  );
}

// Function to clean the search query
function cleanSearchQuery(query) {
  // Extract the actual question from the full text
  let cleanQuery = query;
  
  // If it contains "User question:", take everything after it
  const questionMatch = query.match(/User question:\s*(.*?)(?:\n|$)/i);
  if (questionMatch) {
    cleanQuery = questionMatch[1];
  } else {
    // Otherwise just take the last non-empty line
    const lines = query.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      cleanQuery = lines[lines.length - 1];
    }
  }
  
  // Clean up the query
  cleanQuery = cleanQuery
    .replace(/^(Question:|User:|Q:)\s*/i, '') // Remove any remaining prefixes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Return cleaned query or default
  return cleanQuery || 'help';
}

// Function to perform web search
async function performWebSearch(query) {
  try {
    // Check for required API credentials
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !searchEngineId) {
      console.error('Missing Google Search API credentials');
      return [];
    }

    // Clean and prepare the search terms
    const searchTerms = cleanSearchQuery(query);
    
    // Create the URL with the correct parameters
    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: searchTerms,
      num: 5 // Number of results to return
    });
    
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('Google Search API error:', data.error?.message || response.statusText);
      return [];
    }

    // Format the search results
    if (data.items && data.items.length > 0) {
      const searchResults = data.items.map(item => ({
        title: item.title,
        snippet: item.snippet,
        url: item.link
      }));
      
      return searchResults;
    }

    return [];
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

exports.handler = async function(event, context) {
  let prompt, mathChallenge;
  try {
    ({ prompt, mathChallenge } = JSON.parse(event.body));
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body." })
    };
  }

  // Honeypot spam check
  if (mathChallenge && mathChallenge.trim() !== "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Spam detected." })
    };
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid prompt." })
    };
  }

  // Perform web search if needed
  let searchResults = [];
  if (shouldPerformWebSearch(prompt)) {
    try {
      const results = await performWebSearch(prompt);
      if (Array.isArray(results)) {
        searchResults = results;
      }
    } catch (error) {
      console.error("Error during web search:", error);
      // Continue without search results
    }
  }

  // Modify prompt to include search results if available
  let enhancedPrompt = prompt;
  if (searchResults && searchResults.length > 0) {
    const searchContext = searchResults
      .map(result => `Title: ${result.title}\nSummary: ${result.snippet}\nSource: ${result.url}`)
      .join('\n\n');
    enhancedPrompt = `Web Search Results:\n\n${searchContext}\n\nUser question: ${prompt}\n\nPlease provide a clear, informative answer based on these search results. Focus on relevant information and include source attributions where appropriate.`;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Gemini API key." })
    };
  }
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: enhancedPrompt }]
      }
    ]
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Gemini API error: ${errorText}` })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ response: data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
