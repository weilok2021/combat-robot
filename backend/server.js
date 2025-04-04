const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

// Configuration matching LM Studio settings
const MAX_CONTEXT_LENGTH = 20000; // Exact match from your LM Studio
const MAX_OUTPUT_TOKENS = 163840; // Leaves 552 tokens buffer
const SAFETY_BUFFER = 100; // Reduced for exact context matching
const TIMEOUT_MS = 120000; // 2 minutes for complex generations

const corsOptions = {
  origin: '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(express.json());

// Load robot code
const DEFAULT_CODE = fs.readFileSync(path.join(__dirname, 'default_robot_code.txt'), 'utf-8');

// Optimized system prompt (token-efficient)
const SYSTEM_PROMPT = `MODIFY COMBAT ROBOT CODE:
1. Provide simple/brief explanations
2. RETURN COMPLETE CODE
3. KEEP COMMENTS/STRUCTURE
4. USE FORMAT:
\`\`\`
// MODIFIED CODE
\`\`\`
ORIGINAL CODE:\n`;

// Character-based truncation (more precise for GPT tokenization)
function getTruncatedCode() {
  const maxChars = Math.floor(MAX_CONTEXT_LENGTH * 3.5); // 1 token ~3.5 chars
  return DEFAULT_CODE.slice(0, maxChars).replace(/\n/g, '  ');
}

app.post('/process', async (req, res) => {
  try {
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: "No instruction" });

    const truncatedCode = getTruncatedCode();
    
    const response = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: "deepseek-coder-v2-lite-instruct",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT + truncatedCode
        },
        { 
          role: "user", 
          content: `${instruction}\n[IMPORTANT: Return complete code in code block]`
        }
      ],
      temperature: 0.8, // Match LM Studio
      top_k: 40,        // Match LM Studio
      top_p: 0.95,      // Match LM Studio
      repetition_penalty: 1.1, // Match repeat penalty
      max_tokens: MAX_OUTPUT_TOKENS,
      stop: ["\n```"],
      min_p: 0.05       // Match LM Studio
    }, {
      timeout: TIMEOUT_MS
    });

    // Robust code extraction
    let modifiedCode = response.data.choices[0].message.content;
    modifiedCode = modifiedCode.replace(/```[a-z]*\n?([\s\S]+?)```/s, '$1').trim();

    return res.json({
      modifiedCode,
      truncated: truncatedCode.length < DEFAULT_CODE.length
    });

  } catch (error) {
    console.error("API Error:", error.message);
    return res.status(500).json({
      error: error.response?.data?.error || "Processing failed",
      details: `Model: ${error.response?.data?.model || 'unknown'}`,
      suggestion: "Try simpler instructions or reduce code size"
    });
  }
});

app.listen(3000, () => console.log(`Server running with LM Studio-optimized settings`));