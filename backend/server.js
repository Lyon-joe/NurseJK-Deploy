import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";

dotenv.config();

const app = express();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

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

    const reply = response.choices?.[0]?.message?.content || "No response received.";

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI error:", error);

    res.status(500).json({
      error: error?.message || "Server error"
    });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
