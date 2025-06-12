let documents = [];

async function loadDocuments() {
    const response = await fetch("documents.json");
    documents = await response.json();
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
}

async function sendMessage() {
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
            // Remove markdown heading and comments, just get the bullet points
            const text = await res.text();
            instructions = text.replace(/#.*/g, "").replace(/<!--.*-->/g, "").trim();
        }
    } catch (e) {
        instructions = "";
    }

    // Always include all document chunks
    const contextText = documents.map(doc => doc.text).join("\n---\n");

    // Compose prompt with instructions, all documents, and user question
    const prompt = `Instructions:\n${instructions}\n\nDocuments:\n${contextText}\n\nUser question: ${userText}`;

    // Get reCAPTCHA v3 token
    const siteKey = document.querySelector('meta[name="recaptcha-site-key"]').content;
    let recaptchaToken = "";
    if (window.grecaptcha) {
        try {
            recaptchaToken = await window.grecaptcha.execute(siteKey, { action: 'submit' });
        } catch (e) {
            console.warn("reCAPTCHA error", e);
        }
    }
    document.getElementById("recaptcha-token").value = recaptchaToken;

    // Call Netlify function with math challenge and reCAPTCHA token
    const response = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mathChallenge: mathChallengeValue, recaptchaToken })
    });

    const data = await response.json();
    const reply = data.response?.candidates?.[0]?.content?.parts?.[0]?.text || data.error || "No response.";
    addMessageToChat("Adam's AI", reply, true);
}

// Add ENTER key handler for input
window.onload = function() {
    loadDocuments();
    const input = document.getElementById("user-input");
    input.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();
        }
    });
};
