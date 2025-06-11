const fetch = require("node-fetch");

exports.handler = async function(event, context) {
  let prompt, mathChallenge, recaptchaToken;
  try {
    ({ prompt, mathChallenge, recaptchaToken } = JSON.parse(event.body));
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body." })
    };
  }

  // Check if reCAPTCHA is enabled via environment variable
  const recaptchaEnabled = process.env.RECAPTCHA_ENABLED === 'true';

  // Honeypot spam check
  if (mathChallenge && mathChallenge.trim() !== "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Spam detected." })
    };
  }

  // reCAPTCHA v3 verification (only if enabled)
  if (recaptchaEnabled) {
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (!recaptchaToken || !recaptchaSecret) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing reCAPTCHA token or secret." })
      };
    }
    try {
      const recaptchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${recaptchaSecret}&response=${recaptchaToken}`
      });
      const recaptchaData = await recaptchaRes.json();
      if (!recaptchaData.success || recaptchaData.score < 0.5) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Failed reCAPTCHA verification." })
        };
      }
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "reCAPTCHA verification failed." })
      };
    }
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or invalid prompt." })
    };
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
        parts: [{ text: prompt }]
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
