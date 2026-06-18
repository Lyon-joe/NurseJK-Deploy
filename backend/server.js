import dotenv from "dotenv";
dotenv.config();

console.log("Gemini key status:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing");

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors"; 

import User from "./models/user.js";
import Memory from "./models/Memory.js";
import { auth } from "./middleware/auth.js";
import { generateReply, analyzeWeakTopics } from "./ai/gemini.js";

const app = express();

// ==========================================
// CORS CONFIGURATION (ALIGNED)
// ==========================================
app.use(cors({
  origin: [
    "http://localhost:5173",                   // Standard Vite development port
    "http://localhost:3000",                   // Standard Create-React-App port
    "https://nursejk-assistant-q1oe.onrender.com" // Production web domain (no trailing slash)
  ], 
  credentials: true
}));

app.use(express.json());

// ==========================================
// TEST ROUTE & MONGODB CONNECTION
// ==========================================
app.get("/", (req, res) => {
  res.send("API is running");
});

console.log("MONGO_URI =", process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB error:", err));

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// REGISTER API
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      message: "User created successfully",
      userId: user._id,
      token
    });

  } catch (err) {
    console.error("🔥 REGISTRATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// LOGIN API
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    // Compare passwords
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// PROTECTED TEST ROUTE
app.get("/api/protected", auth, (req, res) => {
  res.json({
    message: "You are authorized 🎉",
    user: req.user
  });
});

// ==========================================
// AI CHAT & RETRIEVAL ROUTE
// ==========================================
app.post("/api/chat/retrieval", auth, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required" });
    }

    // 🧠 STEP 1: Get or Create user memory
    let memory = await Memory.findOne({ userId });
    if (!memory) {
      memory = await Memory.create({
        userId,
        messages: [],
        weakTopics: []
      });
    }

    // 🧠 STEP 2: Build conversation history (Last 6 messages)
    const recentMemory = memory.messages.slice(-6);
    const historyText = recentMemory
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    // 🔍 Format tracked weaknesses for the prompt context
    const studentWeaknesses = memory.weakTopics.length > 0 
      ? memory.weakTopics.join(", ") 
      : "None identified yet";

    // 🧠 STEP 3: Build AI prompt WITH memory context and adaptive metrics
    const prompt = `
You are a professional nursing educator interacting with a nursing student. 

CRITICAL IDENTITY RULE:
- If the user asks who created you, built you, programmed you, or developed you, you must clearly state that your creator/programmer is Joseph Karamuki.

STUDENT INSIGHTS (ADAPTIVE LEARNING):
- The student has demonstrated knowledge gaps or weaknesses in the following topics: [ ${studentWeaknesses} ]. 
- Use this information to gently reinforce concepts, tie related mechanisms back to these weak areas when relevant, or occasionally check their understanding of these items.

Determine the user's intent:
1. If the user is greeting you, asking an identity/meta-question (like who created you), or having casual dialogue, reply warmly and helpfully as a tutor without using a clinical layout.
2. If the request is a clinical question, condition, or nursing topic, you MUST be clinically accurate and use this structured format:
   • Definition
   • Causes
   • Pathophysiology
   • Types/ classification (if applicable)
   • Clinical features
   • Differential diagnosis
   • Investigations
   • Medical management
   • Surgical management
   • Nursing management
   • Prevention
   • Complications

Keep explanations clear, highly educational, and geared towards nursing board preparation.

Conversation history:
${historyText}

Current question/interaction:
${message}
`;

    // 🤖 STEP 4: Call AI
    const reply = await generateReply(prompt);

    // 🧠 STEP 5: Save user + AI messages to memory
    memory.messages.push(
      { role: "user", content: message },
      { role: "ai", content: reply }
    );

    // 🔍 ANALYZE WEAK TOPICS: Automatically detect gaps and prevent duplicates
    const discoveredWeakTopic = await analyzeWeakTopics(message, reply);
    if (discoveredWeakTopic && !memory.weakTopics.includes(discoveredWeakTopic)) {
      memory.weakTopics.push(discoveredWeakTopic);
    }

    await memory.save();

    // 📬 Return response
    return res.json({
      reply,
      userId
    });

  } catch (err) {
    console.error("🔥 AI ERROR:", err);
    return res.status(500).json({ 
      error: "AI request failed",
      details: process.env.NODE_ENV === "development" ? err.message : undefined 
    });
  }
});

// ==========================================
// STUDENT PERFORMANCE ANALYTICS
// ==========================================
app.get("/api/dashboard/performance", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const memory = await Memory.findOne({ userId });

    if (!memory) {
      return res.json({ weakTopics: [], totalMessages: 0 });
    }

    res.json({
      weakTopics: memory.weakTopics,
      totalMessages: memory.messages.length
    });
  } catch (err) {
    console.error("🔥 Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to retrieve student analytics" });
  }
});

// ==========================================
// START SERVER
// ==========================================
app.listen(3001, () => {
  console.log("Server running on port 3001");
});
