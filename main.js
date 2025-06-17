let documents = [];
let conversationHistory = [];
const MAX_HISTORY = 50; // 50 exchanges (100 messages total)

// Load and manage conversation history
function loadConversationHistory() {
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
        const fullHistory = JSON.parse(saved);
        // Always take only the most recent MAX_HISTORY * 2 messages
        conversationHistory = fullHistory.slice(-MAX_HISTORY * 2);
        // Update storage if we trimmed anything
        if (fullHistory.length !== conversationHistory.length) {
            saveConversationHistory();
        }
    }
}

// Save conversation history to localStorage
function saveConversationHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
}

// Add a message to the conversation history
function addToConversationHistory(role, message) {
    // Add new message
    conversationHistory.push({ role, message });
    
    // Trim if needed
    if (conversationHistory.length > MAX_HISTORY * 2) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
    }
    
    // Save the updated history
    saveConversationHistory();
}

// Format the conversation history for prompting
function formatConversationHistory() {
    // Get all except the last message (current question)
    let historyToInclude = conversationHistory.slice(0, -1);
    
    // Ensure we're within limits
    if (historyToInclude.length > MAX_HISTORY * 2) {
        historyToInclude = historyToInclude.slice(-MAX_HISTORY * 2);
    }
    
    // Format as a string
    return historyToInclude.map(entry => 
        `${entry.role}: ${entry.message}`
    ).join('\n');
}

async function loadDocuments() {
    const response = await fetch("documents.json");
    documents = await response.json();
}

// Show/hide thinking animation
function showThinking() {
    document.getElementById('thinking-animation').classList.remove('hidden');
}

function hideThinking() {
    document.getElementById('thinking-animation').classList.add('hidden');
}

function addMessageToChat(sender, message, isMarkdown = false) {
    const chatBox = document.getElementById("chat-box");
    const msgDiv = document.createElement("div");
    if (isMarkdown && window.marked) {
        msgDiv.innerHTML = `<strong>${sender}:</strong> ` + marked.parse(message);
    } else {
        msgDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
    }
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Add to conversation history
    addToConversationHistory(sender, message);
}

async function sendMessage() {
    showThinking();
    try {
        const input = document.getElementById("user-input");
        const mathChallenge = document.getElementById("math-challenge");
        const userText = input.value;
        const mathChallengeValue = mathChallenge.value;
        input.value = "";
        mathChallenge.value = "";
        addMessageToChat("You", userText);

        // Fetch instructions from instructions.md
        let instructions = "";
        try {
            const res = await fetch("instructions.md");
            if (res.ok) {
                instructions = await res.text();
            }
        } catch (e) {
            instructions = "";
        }

        // Always include all document chunks
        const contextText = documents.map(doc => doc.text).join("\n---\n");

        // Compose prompt with instructions, all documents, and user question
        // Get conversation history
        const conversationText = formatConversationHistory();

        // Compose prompt with instructions, documents, conversation history, and user question
        const prompt = `Instructions:\n${instructions}\n\nDocuments:\n${contextText}\n\nConversation History:\n${conversationText}\n\nUser question: ${userText}`;

        // Call Netlify function with math challenge
        const response = await fetch("/.netlify/functions/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt, mathChallenge: mathChallengeValue })
        });

        const data = await response.json();
        const reply = data.response?.candidates?.[0]?.content?.parts?.[0]?.text || data.error || "No response.";
        addMessageToChat("Adam's AI", reply, true);
    } catch (error) {
        console.error('Error:', error);
        addMessageToChat("Adam's AI", "I apologize, but I encountered an error while processing your request. Please try again.", true);
    } finally {
        hideThinking();
    }
}

// Add ENTER key handler for input
window.onload = function() {
    loadDocuments();
    loadConversationHistory();
    const input = document.getElementById("user-input");
    input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
};
