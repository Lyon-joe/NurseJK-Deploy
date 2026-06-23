import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI;
let model;

const getModel = () => {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
    });
  }
  return model;
};

// Helper to retry Gemini API requests with exponential backoff
const generateContentWithRetry = async (prompt, retries = 4, delay = 1000) => {
  const modelInstance = getModel();
  for (let i = 0; i < retries; i++) {
    try {
      const result = await modelInstance.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      console.warn(`⚠️ Gemini API call attempt ${i + 1} failed: ${err.message}`);
      if (i === retries - 1) throw err;
      const waitTime = delay * Math.pow(2, i);
      console.log(`Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Primary function for generating chat replies
export const generateReply = async (message) => {
  return await generateContentWithRetry(message);
};

/**
 * NEW: Analyzes student exchange to find conceptual weaknesses
 * Geared towards categorizing nursing topics for exam preparation
 */
export const analyzeWeakTopics = async (userMessage, aiReply) => {
  try {
    const analysisPrompt = `
You are an expert nursing education auditor.
Analyze this exchange between a nursing student and a tutor. Identify if the student demonstrates a knowledge gap, confusion, or weakness in a specific nursing topic.

Student: "${userMessage}"
Tutor: "${aiReply}"

If a knowledge gap or weak topic is found, respond with ONLY the specific category name (e.g., "Pharmacology: Digoxin Toxicity", "Fluid & Electrolytes: Metabolic Acidosis", "Maternal-Newborn: Placenta Previa").
If the student didn't show a clear conceptual weakness (e.g., they just said thank you, asked a basic greeting, or understood perfectly), respond with the exact word: "NONE".

Response:`;

    const resultText = await generateContentWithRetry(analysisPrompt);
    const cleanedResult = resultText.trim();

    // Check if it's a blank or a negative response
    if (cleanedResult.toUpperCase() === "NONE" || cleanedResult === "") {
      return null;
    }

    return cleanedResult;
  } catch (err) {
    console.error("⚠️ Topic analysis failed:", err);
    return null;
  }
};