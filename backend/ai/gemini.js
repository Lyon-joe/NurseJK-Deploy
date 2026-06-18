import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
});

// Primary function for generating chat replies
export const generateReply = async (message) => {
  const result = await model.generateContent(message);
  const response = await result.response;
  return response.text();
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

    const result = await model.generateContent(analysisPrompt);
    const response = await result.response;
    const cleanedResult = response.text().trim();

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