import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());

const nurseSystemPrompt = `
You are a professional nurse assistant.

Always answer every clinical topic using exactly these sections and in this order:
1. Definition
2. Pathophysiology
3. Risk factors
4. Causes
5. Diagnostic assessment and findings
6. Signs and symptoms
7. Nursing management
8. Complications

Use safe standard clinical guidelines.
Keep the response structured under the required headings only.
`.trim();

app.get("/", (req, res) => {
  res.json({ message: "Nursing AI Assistant API is running" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "The message field is required."
      });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: nurseSystemPrompt },
        { role: "user", content: message }
      ]
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Server error"
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
