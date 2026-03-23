import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd(), "..");
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

loadEnvFile(path.join(rootDir, "backend", ".env"));

const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiEmbeddingModel =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

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
  if (!openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY in backend/.env");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
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
        model: openAiEmbeddingModel,
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
