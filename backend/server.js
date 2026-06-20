import dotenv from "dotenv";
dotenv.config();

console.log("Gemini key status:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing");
console.log("MONGO_URI =", process.env.MONGO_URI);

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
// CORS CONFIGURATION (PRODUCTION ALIGNED - BULLETPROOF)
// ==========================================
const allowedOrigins = [
  "https://nursejk-assistant-q1oe.onrender.com",
  "https://nurse-jk-deploy.vercel.app",
  "https://nurse-jk-deploy-51kt1rnul-nursek.vercel.app" 
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith("http://localhost:")) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (origin.includes(".vercel.app")) {
      return callback(null, true);
    }
    console.log("⚠️ Blocked Origin by CORS Policy:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, 
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ==========================================
// TEST ROUTE & MONGODB CONNECTION
// ==========================================
app.get("/", (req, res) => {
  res.send("API is running");
});

let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("MongoDB connected successfully");
  } catch (err) {
    console.log("DB error:", err);
  }
};

app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid password" });
    }

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

    let memory = await Memory.findOne({ userId });
    if (!memory) {
      memory = await Memory.create({
        userId,
        messages: [],
        weakTopics: []
      });
    }

    const recentMemory = memory.messages.slice(-6);
    const historyText = recentMemory
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    const studentWeaknesses = memory.weakTopics.length > 0 
      ? memory.weakTopics.join(", ") 
      : "None identified yet";

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

    const reply = await generateReply(prompt);

    memory.messages.push(
      { role: "user", content: message },
      { role: "ai", content: reply }
    );

    const discoveredWeakTopic = await analyzeWeakTopics(message, reply);
    if (discoveredWeakTopic && !memory.weakTopics.includes(discoveredWeakTopic)) {
      memory.weakTopics.push(discoveredWeakTopic);
    }

    await memory.save();

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
// EXPLICIT PORT BINDING FOR PRODUCTION
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Application actively listening on port ${PORT}`);
});

export default app;