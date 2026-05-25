import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const envPath = path.join(backendDir, ".env");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

export const config = {
  port: Number(process.env.PORT || 3001),
  chatProvider: process.env.CHAT_PROVIDER || "openai",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  embeddingProvider: process.env.EMBEDDING_PROVIDER || "openai",
  openAiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
  geminiEmbeddingModel:
    process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  backendDir,
  rootDir: path.resolve(backendDir, ".."),
  frontendDir: path.resolve(backendDir, "..", "frontend"),
  sourceNotesPath: path.resolve(
    backendDir,
    "..",
    "database",
    "source",
    "nursing-notes.txt"
  ),
  vectorStorePath: path.resolve(
    backendDir,
    "..",
    "database",
    "vector-store",
    "nursing-embeddings.json"
  ),
  memoryDir: path.resolve(backendDir, "..", "database", "memory"),
  profileMemoryPath: path.resolve(
    backendDir,
    "..",
    "database",
    "memory",
    "profile-memory.json"
  ),
  conversationMemoryPath: path.resolve(
    backendDir,
    "..",
    "database",
    "memory",
    "conversation-memory.jsonl"
  )
};
