# demo-rag-chat

A simple Retrieval-Augmented Generation (RAG) chat demo using Google Gemini API, Netlify Functions, and a static frontend with web search.

## Features

- Chat UI for asking questions about a sample topic.
- Retrieves relevant document snippets from a local JSON knowledge base (`documents.json`).
- Performs web searches using Google Custom Search API for questions requiring current information.
- Sends context-augmented prompts to the Gemini API via a Netlify serverless function.
- Displays AI-generated answers in the chat interface.
- Includes a simple honeypot mechanism for bot/spam protection.
- Smart query detection to determine when web search is needed.

## Project Structure

```sh
netlify/functions/chat.js # Netlify Function
.env # Environment variables
.env.sample # Sample environment variables
.gitignore # Files to ignore in git
documents.json # Sample knowledge base
favicon.ico # Website favicon
index.html # Main HTML page
instructions.md # Custom prompt instructions
main.js # Frontend logic
marked.min.js # MD file formatting
package-lock.json # Node lock file
package.json # Node dependencies
README.md # Project documentation
sitemap.xml # Website sitemap
style.css # Basic styling
```

## Setup

1. **Clone the repository**

   ```sh
   git clone https://github.com/realadammatthew/demo-rag-chat.git
   cd demo-rag-chat
   ```

2. **Install dependencies**

    ```sh
    npm install
    ```

3. **Set up your API keys**

    Copy your API keys into a .env file in the root directory:
    
    ```sh
    GEMINI_API_KEY=your-gemini-api-key-here
    GOOGLE_SEARCH_API_KEY=your-google-api-key-here
    GOOGLE_SEARCH_ENGINE_ID=your-google-search-engine-id-here
    ```

4. **Run locally with Netlify CLI**

    Install Netlify CLI if you don't have it:

    ```sh
    npm install -g netlify-cli
    ```

5. **Start the local dev server**

    ```sh
    netlify dev
    ```

    The app will be available at http://localhost:8888.

## Usage

- Open the app in your browser.
- Type a question related to the sample data.
- The app will find a relevant snippet from documents.json and send it, along with your question, to the Gemini API.
- The AI's answer will appear in the chat.

## How it Works

- `main.js`: Loads custom prompt instructions and custom dataset, requests a reCAPTCHA v3 token, and sends a prompt to the backend.
- `netlify/functions/chat.js`: Receives the prompt, verifies the reCAPTCHA token, performs web search when needed, calls the Gemini API with enhanced context, and returns the AI's response.
- `documents.json`: Contains sample data for retrieval.
- `instructions.md`: Contains custom prompt instructions for the chatbot.
- `index.html` and `style.css`: Provide the chat UI.

The application now includes intelligent web search capabilities:
- Automatically detects when a question might benefit from current web information
- Uses Google Custom Search API to fetch relevant search results
- Enhances prompts with search results for better context
- Maintains original RAG capabilities for static knowledge base queries

## Anti-Spam Protection

This demo uses a hidden honeypot field for spam prevention. The honeypot field is visually hidden from users but may be filled by bots. If the honeypot is filled, the backend will silently reject the request as spam.

## Customizing Bot Behavior

You can control the chatbot's behavior and guardrails by editing the `instructions.md` file in the project root. The contents of this file are automatically prepended to every prompt sent to the Gemini API.

**How it works:**
- Edit `instructions.md` to add, remove, or change instructions for the bot.
- The file supports Markdown, and all contents are sent to the AI.
- Example guardrails include how to handle confidential questions, off-topic prompts, or how to represent the company.
- Changes take effect immediately on the next chat request—no server restart needed.

This makes it easy to experiment with different bot personalities, compliance guardrails, or company messaging.

## Deployment

- Deploy to Netlify by connecting your repository and setting the `GEMINI_API_KEY`, `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` environment variables in the Netlify dashboard.

## Notes

- This is a demo and does not include authentication or advanced error handling.
- The Gemini API key should be kept secret; do not expose it in client-side code or public repos.

## License

© Copyright 2025 [Adam Matthew Steinberger LLC](https://hire.adam.matthewsteinberger.com), All Rights Reserved.

## Credits
Built with Shalom by Adam Matthew Steinberger.

[📪](mailto:adam@matthewsteinberger.com) [:octocat:](https://github.com/realadammatthew) [𝕏](https://x.com/realadammatthew) [☕](https://coff.ee/realadammatthew)