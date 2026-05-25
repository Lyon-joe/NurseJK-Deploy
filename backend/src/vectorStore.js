import fs from "node:fs";
import { config } from "./config.js";
import { generateEmbedding } from "./openaiClient.js";

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    dot += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function loadVectorStore() {
  if (!fs.existsSync(config.vectorStorePath)) {
    return { items: [] };
  }

  const store = JSON.parse(fs.readFileSync(config.vectorStorePath, "utf8"));

  if (!Array.isArray(store.items)) {
    throw new Error("Vector store is invalid or empty.");
  }

  return store;
}

export function isVectorStoreReady() {
  if (!fs.existsSync(config.vectorStorePath)) {
    return false;
  }

  try {
    const store = JSON.parse(fs.readFileSync(config.vectorStorePath, "utf8"));
    return Array.isArray(store.items) && store.items.length > 0;
  } catch {
    return false;
  }
}

export async function searchVectorStore(query, topK = 3) {
  const store = loadVectorStore();

  if (!store.items.length) {
    return [];
  }

  const queryEmbedding = await generateEmbedding(query);
  const requestedTopK = Number.isInteger(topK) ? topK : 3;
  const limitedTopK = Math.max(1, Math.min(requestedTopK, 10));

  return store.items
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryEmbedding.embedding, item.embedding)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limitedTopK);
}
