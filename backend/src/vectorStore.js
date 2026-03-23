import fs from "node:fs";
import path from "node:path";
import { generateEmbedding } from "./openaiClient.js";

const vectorStorePath = path.resolve(
  process.cwd(),
  "..",
  "database",
  "vector-store",
  "nursing-embeddings.json"
);

function cosineSimilarity(a, b) {
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
  if (!fs.existsSync(vectorStorePath)) {
    throw new Error(
      "Vector store not found. Run `node scripts/buildVectorStore.js` first."
    );
  }

  return JSON.parse(fs.readFileSync(vectorStorePath, "utf8"));
}

export async function searchVectorStore(query, topK = 3) {
  const store = loadVectorStore();
  const queryEmbedding = await generateEmbedding(query);

  if (!store.items?.length) {
    return [];
  }

  const limitedTopK = Math.max(1, Math.min(topK, 10));

  return store.items
    .map((item) => ({
      ...item,
      score: cosineSimilarity(queryEmbedding.embedding, item.embedding)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limitedTopK);
}
