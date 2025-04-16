// const express = require('express');
// const cors = require('cors');
// const axios = require('axios');
// const fs = require('fs');
// const path = require('path');
// const app = express();

// // Configuration
// const MAX_CONTEXT_LENGTH = 20000;
// const MAX_OUTPUT_TOKENS = 4096; // Reduced for better quality
// const TIMEOUT_MS = 120000;

// const corsOptions = {
//   origin: '*',
//   methods: ['POST'],
//   allowedHeaders: ['Content-Type']
// };
// app.use(cors(corsOptions));
// app.use(express.json());

// // Chat history storage
// let chatHistory = [];

// // Improved system prompt
// const SYSTEM_PROMPT = `You are a helpful coding assistant. Follow these rules:
// 1. Provide concise explanations before code
// 2. Format code in markdown code blocks
// 3. Keep responses under ${MAX_OUTPUT_TOKENS} tokens
// 4. Maintain conversation context`;

// app.post('/chat', async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message) return res.status(400).json({ error: "Empty message" });

//     // Add user message to history
//     chatHistory.push({ role: "user", content: message });

//     // Prepare messages for LLM (last 3 exchanges)
//     const messages = [
//       { role: "system", content: SYSTEM_PROMPT },
//       ...chatHistory.slice(-6) // Keep last 3 exchanges (user+assistant)
//     ];

//     const response = await axios.post('http://localhost:1234/v1/chat/completions', {
//       model: "deepseek-coder-v2-lite-instruct",
//       messages,
//       temperature: 0.7,
//       top_p: 0.9,
//       max_tokens: MAX_OUTPUT_TOKENS,
//       stop: ["\n```"],
//       frequency_penalty: 0.5,
//       presence_penalty: 0.5
//     }, { timeout: TIMEOUT_MS });

//     const reply = response.data.choices[0].message.content;
    
//     // Add assistant reply to history
//     chatHistory.push({ role: "assistant", content: reply });

//     return res.json({
//       reply,
//       tokenUsage: response.data.usage
//     });

//   } catch (error) {
//     console.error("API Error:", error.message);
//     return res.status(500).json({
//       error: "Processing failed",
//       details: error.message,
//       suggestion: "Try rephrasing your question"
//     });
//   }
// });

// // Clear chat history endpoint
// app.post('/clear', (req, res) => {
//   chatHistory = [];
//   res.json({ status: "Chat history cleared" });
// });

// app.listen(3000, () => console.log(`Server running on port 3000`));


// server.js - Complete Modified Version
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

// Configuration - Increased limits for better responses
const MAX_CONTEXT_LENGTH = 40000;  // Increased context
const MAX_OUTPUT_TOKENS = 8000;    // Doubled output length
const TIMEOUT_MS = 180000;         // Longer timeout

const corsOptions = {
  origin: '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(express.json());

// Chat history storage
let chatHistory = [];

// Load and pre-process combat robot code
let COMBAT_ROBOT_CODE = '';
try {
  COMBAT_ROBOT_CODE = fs.readFileSync(
    path.join(__dirname, 'default_robot_code.txt'), 
    'utf8'
  ).substring(0, 15000); // Limit code size to prevent overflow
} catch (err) {
  console.error("Error loading robot code:", err);
  COMBAT_ROBOT_CODE = "// Default combat robot code not found";
}

// Enhanced system prompt with combat focus
const SYSTEM_PROMPT = `You are COMBAT-CODEX, a specialized AI for combat robot programming. Rules:
1. PRIORITIZE practical combat robotics solutions
2. STRUCTURE responses:
   - make a short greet to the user and repeat the situation mentioned by user briefly.
   - modify the loaded default combat robot code according to user need.
3. FORMAT modified code properly with markdown

Base Combat Robot Code (modify as needed):
\`\`\`Combat Robot Code
${COMBAT_ROBOT_CODE}
\`\`\``;

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ 
        error: "Please provide combat instructions",
        example: "Make the robot prioritize defensive maneuvers when outnumbered"
      });
    }

    // Add user message to history
    chatHistory.push({ role: "user", content: `COMBAT REQUEST: ${message}` });

    // Prepare messages with combat context
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...chatHistory.slice(-4) // Keep tighter context
    ];

    const response = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: "deepseek-coder-v2-lite-instruct",
      messages,
      temperature: 0.3,       // Lower for more focused responses
      top_p: 0.7,
      max_tokens: MAX_OUTPUT_TOKENS,
      stop: ["\n```\n"],      // Better code block handling
      frequency_penalty: 0.2,
      presence_penalty: 0.2
    }, { 
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const reply = response.data.choices[0].message.content;
    
    // Add assistant reply to history
    chatHistory.push({ 
      role: "assistant", 
      content: `COMBAT SOLUTION:\n${reply}` 
    });

    return res.json({
      reply,
      tokenUsage: response.data.usage
    });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: "Combat analysis failed",
      details: error.response?.data?.error || error.message,
      solution: "Try breaking your request into smaller tactical components"
    });
  }
});

// Enhanced clear endpoint
app.post('/clear', (req, res) => {
  chatHistory = [];
  res.json({ 
    status: "Tactical memory cleared",
    reminder: "Remember to re-specify combat parameters"
  });
});

app.listen(3000, () => console.log(`Combat Codex active on port 3000`));