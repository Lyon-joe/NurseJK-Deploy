import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const rootDir = path.resolve(backendDir, "..");
const inputPath = path.join(rootDir, "database", "source", "nursing-notes.txt");
const outputDir = path.join(rootDir, "database", "vector-store");
const outputPath = path.join(outputDir, "nursing-embeddings.json");
const sourceFileName = path.basename(inputPath);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
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

loadEnvFile(path.join(backendDir, ".env"));

const openAiApiKey = process.env.OPENAI_API_KEY || "";
const embeddingProvider = process.env.EMBEDDING_PROVIDER || "openai";
const openAiEmbeddingModel =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const geminiEmbeddingModel =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const maxEmbeddingRetries = 6;

function normalizeText(text) {
  return text
    .replace(/\uFFFD/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(rawText) {
  const normalized = normalizeText(rawText);
  const sections = normalized
    .split(/\n(?=[A-Z][A-Z0-9 .,'()/:-]{4,}$)/)
    .map((section) => section.trim())
    .filter(Boolean);

  const chunks = [];
  let counter = 1;

  for (const section of sections) {
    const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = lines[0]?.slice(0, 120) || `Section ${counter}`;
    let buffer = "";

    for (const line of lines.slice(1)) {
      const candidate = buffer ? `${buffer} ${line}` : line;

      if (candidate.length > 900 && buffer) {
        chunks.push({
          id: `chunk-${counter}`,
          title,
          text: buffer,
          metadata: {
            source: sourceFileName,
            topic: title
          }
        });
        counter += 1;
        buffer = line;
      } else {
        buffer = candidate;
      }
    }

    if (buffer) {
      chunks.push({
        id: `chunk-${counter}`,
        title,
        text: buffer,
        metadata: {
          source: sourceFileName,
          topic: title
        }
      });
      counter += 1;
    }
  }

  return chunks;
}

async function createEmbedding(text) {
  const provider = embeddingProvider.toLowerCase();

  if (provider === "gemini") {
    return createGeminiEmbedding(text);
  }

  return createOpenAiEmbedding(text);
}

async function createOpenAiEmbedding(text) {
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY in backend/.env");
  }

  let response;

  try {
    response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`
      },
      body: JSON.stringify({
        model: openAiEmbeddingModel,
        input: text
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? ` Cause: ${error.cause.message}`
        : "";

    throw new Error(`Embedding network request failed: ${message}.${cause}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("Embedding response was invalid.");
  }

  return embedding;
}

function geminiModelPath(model) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readRetryDelayMs(errorText) {
  try {
    const parsed = JSON.parse(errorText);
    const retryDelay = parsed.error?.details?.find((detail) =>
      typeof detail.retryDelay === "string"
    )?.retryDelay;

    if (retryDelay?.endsWith("s")) {
      return Math.ceil(Number(retryDelay.slice(0, -1)) * 1000);
    }
  } catch {
    const match = errorText.match(/retry in ([\d.]+)s/i);
    if (match) {
      return Math.ceil(Number(match[1]) * 1000);
    }
  }

  return 65000;
}

async function createGeminiEmbedding(text) {
  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY in backend/.env");
  }

  const modelPath = geminiModelPath(geminiEmbeddingModel);
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`;

  for (let attempt = 1; attempt <= maxEmbeddingRetries; attempt += 1) {
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey
        },
        body: JSON.stringify({
          model: modelPath,
          content: {
            parts: [{ text }]
          }
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown network error";
      const cause =
        error instanceof Error && error.cause instanceof Error
          ? ` Cause: ${error.cause.message}`
          : "";

      throw new Error(`Embedding network request failed: ${message}.${cause}`);
    }

    if (response.status === 429 && attempt < maxEmbeddingRetries) {
      const errorText = await response.text();
      const retryDelayMs = readRetryDelayMs(errorText);
      console.log(
        `Gemini rate limit reached. Retrying in ${Math.ceil(
          retryDelayMs / 1000
        )}s...`
      );
      await sleep(retryDelayMs + 1000);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini embedding request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values ?? data.embeddings?.[0]?.values;

    if (!Array.isArray(embedding)) {
      throw new Error("Gemini embedding response was invalid.");
    }

    return embedding;
  }

  throw new Error("Gemini embedding request failed after retrying.");
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(
      `Source file not found at ${inputPath}. Add your nursing notes first.`
    );
  }

  const sourceText = fs.readFileSync(inputPath, "utf8");
  const chunks = chunkText(sourceText);
  const items = [];

  for (const chunk of chunks) {
    const embedding = await createEmbedding(`${chunk.title}\n${chunk.text}`);
    items.push({
      ...chunk,
      embedding
    });
    console.log(`Embedded ${chunk.id}: ${chunk.title}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        provider: embeddingProvider.toLowerCase(),
        model:
          embeddingProvider.toLowerCase() === "gemini"
            ? geminiEmbeddingModel
            : openAiEmbeddingModel,
        createdAt: new Date().toISOString(),
        count: items.length,
        items
      },
      null,
      2
    )
  );

  console.log(`Saved vector store to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
