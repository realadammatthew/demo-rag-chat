const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

// === LOAD FILES SECURELY FROM FUNCTION DIR ===
const loadFile = (filename) => {
  try {
    const filePath = path.join(__dirname, filename);
    return fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Failed to load ${filename}:`, err.message);
    return "";
  }
};

const INSTRUCTIONS = loadFile("instructions.md");
const CORPUS_JSON = loadFile("corpus.json");
const DOCUMENTS_JSON = loadFile("documents.json");

let CORPUS = [];
let DOCUMENTS = [];

try {
  CORPUS = CORPUS_JSON ? JSON.parse(CORPUS_JSON) : [];
  DOCUMENTS = DOCUMENTS_JSON ? JSON.parse(DOCUMENTS_JSON) : [];
} catch (err) {
  console.error("Failed to parse JSON:", err);
}

// === 1. Find Best Corpus Match (Semantic Scoring) ===
function findBestCorpusMatch(userPrompt) {
  const userLower = userPrompt.toLowerCase().trim();
  const userWords = userLower.split(' ').filter(w => w.length > 3);

  // High-value keywords (your sales pillars)
  const HIGH_VALUE_KEYWORDS = [
    'rag', 'prompt engineering', 'payroll', 'automation', 'privacy',
    'integration', 'self-hosted', 'hitl', 'team enablement'
  ];

  let bestMatch = null;
  let bestScore = -1;

  CORPUS.forEach(entry => {
    let score = 0;

    const promptLower = entry.prompt.toLowerCase();
    const responseLower = entry.response.toLowerCase();

    // 1. Prompt word overlap (3 pts per shared word)
    const promptWords = promptLower.split(' ').filter(w => w.length > 3);
    const promptMatches = userWords.filter(w => promptWords.includes(w));
    score += promptMatches.length * 3;

    // 2. Answer word overlap (2 pts per shared word)
    const answerWords = responseLower.split(' ').filter(w => w.length > 3);
    const answerMatches = userWords.filter(w => answerWords.includes(w));
    score += answerMatches.length * 2;

    // 3. High-value keyword bonus (+5 per match)
    const highValueMatches = HIGH_VALUE_KEYWORDS.filter(kw => 
      promptLower.includes(kw) || responseLower.includes(kw)
    );
    score += highValueMatches.length * 5;

    // 4. Exact phrase bonus (+10)
    if (promptLower.includes(userLower) || responseLower.includes(userLower)) {
      score += 10;
    }

    // Update best
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  });

  return bestMatch; // Returns null if no score > 0
}

// === 2. Web Search Trigger (Always allowed as secondary enhancement) ===
function shouldPerformWebSearch(prompt) {
  const actual = prompt.split('\n').pop() || prompt;
  const indicators = ["search", "find", "look up", "current", "latest", "news", "recent", "today", "2025"];
  return indicators.some(ind => actual.toLowerCase().includes(ind));
}

// === 3. Clean Query ===
function cleanSearchQuery(query) {
  let clean = query;
  const match = query.match(/User question:\s*(.*?)(?:\n|$)/i);
  if (match) clean = match[1];
  else {
    const lines = query.split('\n').filter(l => l.trim());
    clean = lines[lines.length - 1] || clean;
  }
  return clean.replace(/^(Question:|User:|Q:)\s*/i, '')
             .replace(/\s+/g, ' ')
             .trim() || 'help';
}

// === 4. Web Search ===
async function performWebSearch(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!apiKey || !searchEngineId) return [];

  const q = cleanSearchQuery(query);
  const params = new URLSearchParams({ key: apiKey, cx: searchEngineId, q, num: 3 });

  try {
    const url = `https://www.googleapis.com/customsearch/v1?${params}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return [];
    return (data.items || []).map(i => ({ title: i.title, snippet: i.snippet, url: i.link }));
  } catch (err) {
    console.error("Search error:", err);
    return [];
  }
}

// === MAIN HANDLER ===
exports.handler = async function(event, context) {
  let prompt, mathChallenge;
  try {
    ({ prompt, mathChallenge } = JSON.parse(event.body));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON." }) };
  }

  if (mathChallenge?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Spam." }) };
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "No prompt." }) };
  }

  const userQuestion = prompt.trim();

  // === STEP 1: Corpus First (Primary Source) ===
  const corpusMatch = findBestCorpusMatch(userQuestion);
  
  // === STEP 2: RAG Always ===
  const ragContext = DOCUMENTS.map(doc => doc.text).join("\n---\n");

  // === STEP 3: Web Search as Secondary Enhancement (Always Check) ===
  const doSearch = shouldPerformWebSearch(userQuestion);
  const searchResults = doSearch ? await performWebSearch(userQuestion) : [];
  const searchContext = searchResults.length > 0
    ? `\n\n**Secondary Web Context (enhance if relevant):**\n${searchResults.map(r => `Title: ${r.title}\nSummary: ${r.snippet}\nSource: ${r.url}`).join('\n\n')}`
    : '';

  let finalPrompt;

  if (corpusMatch) {
    // === Corpus Primary + Web Secondary ===
    finalPrompt = `
${INSTRUCTIONS}

**Primary Authoritative Source (use this first, never contradict):**
"""
${corpusMatch.response}
"""

**RAG Context (internal knowledge):**
"""
${ragContext}
"""

${searchContext}

**User asked:** "${userQuestion}"

Respond in a **warm, professional, conversational tone**.
**Primary: Paraphrase/adapt the authoritative corpus answer naturally.**
**Secondary: Use web context ONLY to enhance/clarify if it adds value — cite sources, but defer to corpus.**
**Never contradict corpus**. End with CTA if appropriate.
    `.trim();
  } else {
    // === No Corpus: Web as Primary Fallback ===
    const webContext = searchResults.length > 0
      ? searchResults.map(r => `Title: ${r.title}\nSummary: ${r.snippet}\nSource: ${r.url}`).join('\n\n')
      : "No external sources.";

    finalPrompt = `
${INSTRUCTIONS}

**RAG Context (internal knowledge):**
"""
${ragContext}
"""

${searchResults.length > 0 ? `**Web Results:**\n\n${webContext}\n\n` : ''}

**User:** "${userQuestion}"

Answer helpfully. Focus on **custom RAG, privacy, engineering**.
If unsure: "I don't have that in my training, but Adam can help — book a consult at tidycal.com/realadammatthew"
    `.trim();
  }

  // === Call Gemini ===
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "No Gemini key." }) };
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const payload = { contents: [{ parts: [{ text: finalPrompt }] }] };

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: err }) };
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";

    return { statusCode: 200, body: JSON.stringify({ response: text }) };
  } catch (err) {
    console.error("Gemini error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "AI failed." }) };
  }
};