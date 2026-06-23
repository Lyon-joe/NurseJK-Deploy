import dotenv from "dotenv";
dotenv.config();

console.log("Gemini key status:", process.env.GEMINI_API_KEY ? "Loaded" : "Missing");
console.log("RAW KEY VALUE IS:", `[${process.env.GEMINI_API_KEY}]`);
console.log("MONGO_URI =", process.env.MONGO_URI);

import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors"; 
import path from "path";
import fs from "fs"; 
import multer from "multer"; 
import { fileURLToPath } from "url";

import User from "./models/user.js";
import Memory from "./models/Memory.js";
import { auth } from "./middleware/auth.js";
import { generateReply, analyzeWeakTopics } from "./ai/gemini.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// AUTOMATED MATERIAL STORAGE ENGINE CONFIG
// ==========================================
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExt = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + fileExt);
  }
});

const upload = multer({ storage: storage });

// ==========================================
// CORS CONFIGURATION (PRODUCTION ALIGNED)
// ==========================================
const allowedOrigins = [
  "https://nursejk-assistant-q1oe.onrender.com",
  "https://nurse-jk-deploy.vercel.app",
  "https://nurse-jk-frontend.onrender.com" 
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith("http://localhost:") || allowedOrigins.includes(origin) || origin.includes(".vercel.app")) {
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

// Serve uploaded material assets statically (Placed safely above routing endpoints)
app.use("/uploads", express.static(uploadDir));

// ==========================================
// MONGO DATABASE CONNECTIVITY
// ==========================================
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
// SCOPED API ROUTER (PREVENTS PROXY BREAKAGE)
// ==========================================
const apiRouter = express.Router();

// All routes added to apiRouter will automatically have the "/api" prefix pathing.

// 🛡️ UPLOAD PIPELINE
apiRouter.post("/materials/manual-add", auth, async (req, res) => {
  try {
    const { name, type, url, size } = req.body;
    // You can add logic here to save to your MongoDB 'Material' schema
    res.status(201).json({ success: true, name, type, url, size });
  } catch (err) {
    res.status(500).json({ error: "Failed to register material" });
  }
});
// Add this to your apiRouter block in server.js
apiRouter.post("/materials/manual-add", auth, async (req, res) => {
  try {
    // Expecting: { "name": "Document Name", "url": "https://...", "type": "pdf" }
    const { name, url, type } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: "Name and URL are required for manual addition." });
    }

    // Logic: If you have a 'Material' model, save it here.
    // If you are just passing it back for state management, confirm it here.
    const manualEntry = {
      id: Date.now().toString(),
      name,
      type: type || "unknown",
      url,
      manual: true
    };

    console.log("✅ Manual entry processed:", manualEntry);
    return res.status(201).json(manualEntry);

  } catch (err) {
    console.error("🔥 MANUAL ENTRY FAULT:", err);
    return res.status(500).json({ error: "Failed to process manual entry." });
  }
});

// 🔐 AUTHENTICATION ENDPOINTS
apiRouter.post("/auth/register", async (req, res) => {
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

apiRouter.post("/auth/login", async (req, res) => {
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

apiRouter.get("/protected", auth, (req, res) => {
  res.json({
    message: "You are authorized 🎉",
    user: req.user
  });
});

// 🧠 AI CHAT & RETRIEVAL
apiRouter.post("/chat/retrieval", auth, async (req, res) => {
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

// ⏳ RECENT THREAD CONVERSATIONS
apiRouter.get("/conversations", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const memory = await Memory.findOne({ userId });

    if (!memory || !memory.messages || memory.messages.length === 0) {
      return res.json({ conversations: [] });
    }

    const formattedConversations = [];
    
    for (let i = 0; i < memory.messages.length; i += 2) {
      const userMsg = memory.messages[i];
      const aiMsg = memory.messages[i + 1];

      if (userMsg && userMsg.role === "user") {
        formattedConversations.push({
          title: userMsg.content.substring(0, 32) + (userMsg.content.length > 32 ? "..." : ""),
          userMessage: userMsg.content,
          assistantReply: aiMsg ? aiMsg.content : "No response generated.",
          createdAt: memory.updatedAt || new Date()
        });
      }
    }

    return res.json({ 
      conversations: formattedConversations.reverse() 
    });

  } catch (err) {
    console.error("🔥 FAILED TO RETRIEVE RECENT HISTORY:", err);
    return res.status(500).json({ error: "Failed to load recent conversation streams." });
  }
});

// 📊 PERFORMANCE ANALYTICS DASHBOARD
apiRouter.get("/dashboard/performance", auth, async (req, res) => {
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

// Mount the router onto the app with the formal prefix
app.use("/api", apiRouter);

// ==========================================
// SERVE FRONTEND STATIC ASSETS IN PRODUCTION
// ==========================================
app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// ==========================================
// SYSTEM LAUNCH & PORT BINDING
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Application actively listening on port ${PORT}`);
});

export default app;