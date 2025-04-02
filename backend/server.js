const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();

// Configuration
const MAX_CONTEXT_LENGTH = 4096;
const SAFETY_BUFFER = 256; // Reserve 256 tokens for metadata
const MAX_OUTPUT_TOKENS = 2048; // Maximum allowed by many models
const TIMEOUT_MS = 60000; // 60 second timeout

const corsOptions = {
  origin: '*', // Allow all origins for development
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(express.json());

// Load robot code
const DEFAULT_CODE = fs.readFileSync(path.join(__dirname, 'default_robot_code.txt'), 'utf-8');

// System prompt designed for maximum code retention
const SYSTEM_PROMPT = `You are a combat robot code modifier. Rules:
1. Return ONLY the complete modified code in a single Markdown code block
2. Preserve ALL original comments and structure
3. Change ONLY the parameters specified in the instruction
4. Never add explanations outside the code block

Original code will follow after this line:\n`;

// Calculate available space for the code
const PROMPT_OVERHEAD = SYSTEM_PROMPT.length + 100; // Instruction buffer
const MAX_CODE_LENGTH = MAX_CONTEXT_LENGTH - PROMPT_OVERHEAD - SAFETY_BUFFER;

// Truncate code to fit context window
function getTruncatedCode() {
  const codeLines = DEFAULT_CODE.split('\n');
  let truncatedCode = '';
  let totalLength = 0;
  
  for (const line of codeLines) {
    if (totalLength + line.length > MAX_CODE_LENGTH) break;
    truncatedCode += line + '\n';
    totalLength += line.length + 1; // +1 for newline
  }
  
  return truncatedCode;
}

app.post('/process', async (req, res) => {
  try {
    const { instruction } = req.body;
    if (!instruction) {
      return res.status(400).json({ error: "No instruction provided" });
    }

    const truncatedCode = getTruncatedCode();
    const fullPrompt = SYSTEM_PROMPT + truncatedCode;
    
    console.log(`Processing (Prompt: ${fullPrompt.length} chars, Instruction: ${instruction.length} chars)`);

    const response = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: "deepseek-coder-v2-lite-instruct",
      messages: [
        { role: "system", content: fullPrompt },
        { role: "user", content: instruction }
      ],
      temperature: 0.3, // Balanced between creativity and precision
      max_tokens: MAX_OUTPUT_TOKENS,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: false
    }, {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      timeout: TIMEOUT_MS
    });

    // Extract code from Markdown block
    let modifiedCode = response.data.choices[0].message.content;
    const codeBlockMatch = modifiedCode.match(/```(?:[a-z]*\n)?([\s\S]*?)\n```/);
    
    if (codeBlockMatch) {
      modifiedCode = codeBlockMatch[1];
    } else {
      // Fallback: Take everything before the first non-code line
      modifiedCode = modifiedCode.split('\n\n')[0];
    }

    return res.json({ 
      modifiedCode: modifiedCode.trim(),
      truncated: truncatedCode.length < DEFAULT_CODE.length
    });

  } catch (error) {
    console.error("API Error:", error.message);
    if (error.response) {
      console.error("Response Data:", error.response.data);
    }
    return res.status(500).json({ 
      error: "Processing failed",
      details: error.message,
      suggestion: "Try a shorter instruction or split complex changes into multiple requests"
    });
  }
});

app.listen(3000, () => {
  console.log(`Server running with:
  - Max context: ${MAX_CONTEXT_LENGTH} tokens
  - Max output: ${MAX_OUTPUT_TOKENS} tokens
  - Timeout: ${TIMEOUT_MS}ms`
  );
});


// const express = require('express');
// const cors = require('cors');
// const axios = require('axios');
// const fs = require('fs');
// const path = require('path');
// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Load default robot code
// const DEFAULT_CODE = fs.readFileSync('./default_robot_code.txt', 'utf-8');

// // Strict system prompt template
// const SYSTEM_PROMPT = `
// You are a combat robot code modifier. Follow these rules STRICTLY:
// 1. Return ONLY the full modified code - NO explanations, NO markdown, NO comments
// 2. Preserve all original code structure and comments
// 3. Only modify what the instruction specifically requests
// 4. Maintain consistent formatting
// 5. If unsure, return the original code unchanged

// Original code to modify:
// ${DEFAULT_CODE}
// `;

// app.post('/process', async (req, res) => {
//   try {
//     const { instruction } = req.body;
    
//     if (!instruction) {
//       return res.status(400).json({ error: "No instruction provided" });
//     }

//     console.log(`Processing instruction: "${instruction}"`);

//     const response = await axios.post('http://localhost:1234/v1/chat/completions', {
//       model: "deepseek-coder-v2-lite-instruct", // Must match LM Studio's exact model name
//       messages: [
//         { 
//           role: "system", 
//           content: SYSTEM_PROMPT 
//         },
//         {
//           role: "user",
//           content: `Instruction: ${instruction}`
//         }
//       ],
//       temperature: 0.8, // Lower for more deterministic code changes
//       max_tokens: 4096,
//       stop: ["\n//"] // Stop generation before comments
//     }, { timeout: 30000 }); // 30-second timeout

//     let modifiedCode = response.data.choices[0].message.content;

//     // Clean the response
//     modifiedCode = modifiedCode
//       .replace(/```[a-z]*/g, '') // Remove code block markers
//       .replace(/\/\/.*$/gm, '')   // Remove single-line comments
//       .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
//       .trim();

//     console.log("Successfully processed instruction");
//     return res.json({ 
//       modifiedCode,
//       originalInstruction: instruction 
//     });

//   } catch (error) {
//     console.error("Error:", error.message);
//     if (error.response) {
//       console.error("LM Studio response:", error.response.data);
//     }
//     return res.status(500).json({ 
//       error: "Failed to process instruction",
//       details: error.message 
//     });
//   }
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error('Server error:', err);
//   res.status(500).json({ error: 'Internal server error' });
// });

// app.listen(3000, () => {
//   console.log('Server running on http://localhost:3000');
//   console.log('LM Studio expected at http://localhost:1234');
// });