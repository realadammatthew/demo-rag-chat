let conversationHistory = [];
const MAX_HISTORY = 50;

// Load/Save history
function loadConversationHistory() {
  const saved = localStorage.getItem('chatHistory');
  if (saved) {
    const full = JSON.parse(saved);
    conversationHistory = full.slice(-MAX_HISTORY * 2);
    if (full.length !== conversationHistory.length) saveConversationHistory();
  }
}

function saveConversationHistory() {
  localStorage.setItem('chatHistory', JSON.stringify(conversationHistory));
}

function addToConversationHistory(role, message) {
  conversationHistory.push({ role, message });
  if (conversationHistory.length > MAX_HISTORY * 2) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY * 2);
  }
  saveConversationHistory();
}

function formatConversationHistory() {
  return conversationHistory.slice(0, -1)
    .map(entry => entry.role === 'You' ? `${entry.role}: ${entry.message}` : entry.message)
    .join('\n');
}

function showThinking() {
  document.getElementById('thinking-animation').classList.remove('hidden');
}

function hideThinking() {
  document.getElementById('thinking-animation').classList.add('hidden');
}

function addMessageToChat(sender, message, isMarkdown = false) {
  const chatBox = document.getElementById("chat-box");
  const div = document.createElement("div");
  div.innerHTML = isMarkdown && window.marked
    ? `<strong>${sender}:</strong> ${marked.parse(message)}`
    : `<strong>${sender}:</strong> ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  addToConversationHistory(sender, message);
}

async function sendMessage() {
  showThinking();
  try {
    const input = document.getElementById("user-input");
    const math = document.getElementById("math-challenge");
    const userText = input.value.trim();
    const mathVal = math.value;

    if (!userText) return;

    input.value = "";
    math.value = "";
    addMessageToChat("You", userText);

    const history = formatConversationHistory();
    const prompt = history ? `${history}\nUser question: ${userText}` : userText;

    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, mathChallenge: mathVal })
    });

    const data = await res.json();
    const reply = data.response || data.error || "Sorry, something went wrong.";
    addMessageToChat("Adam's AI", reply, true);
  } catch (err) {
    addMessageToChat("Adam's AI", "I encountered an error. Please try again.", true);
  } finally {
    hideThinking();
  }
}

// Init
window.onload = function() {
  loadConversationHistory();
  const input = document.getElementById("user-input");
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
};