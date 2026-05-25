import express from "express";
import cors from "cors";
import { config } from "./config.js";
import {
  generateEmbedding,
  generateNursingReply,
  generateRetrievalReply
} from "./openaiClient.js";
import { listConversationTurns, saveConversationTurn } from "./memoryStore.js";
import { isVectorStoreReady, searchVectorStore } from "./vectorStore.js";

const app = express();

function readMessage(body) {
  return typeof body.message === "string" ? body.message.trim() : "";
}

function toClientError(error) {
  return {
    error: error instanceof Error ? error.message : "Unexpected server error."
  };
}

function wrapRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json(toClientError(error));
    }
  };
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(
  express.static(config.frontendDir, {
    etag: false,
    lastModified: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "no-store");
    }
  })
);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "nurse-ai-backend",
    chatProvider: config.chatProvider,
    model:
      config.chatProvider.toLowerCase() === "gemini"
        ? config.geminiChatModel
        : config.openAiModel,
    embeddingProvider: config.embeddingProvider,
    embeddingModel:
      config.embeddingProvider.toLowerCase() === "gemini"
        ? config.geminiEmbeddingModel
        : config.openAiEmbeddingModel,
    vectorStoreReady: isVectorStoreReady()
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "nurse-ai-backend"
  });
});

app.get("/api/conversations", (_req, res) => {
  res.json({
    conversations: listConversationTurns()
  });
});

app.post(
  "/api/chat",
  wrapRoute(async (req, res) => {
    const message = readMessage(req.body);

    if (!message) {
      res.status(400).json({ error: "The message field is required." });
      return;
    }

    const reply = await generateNursingReply(message);
    saveConversationTurn(message, reply, "chat");
    res.json({ reply });
  })
);

app.post(
  "/api/chat/retrieval",
  wrapRoute(async (req, res) => {
    const message = readMessage(req.body);

    if (!message) {
      res.status(400).json({ error: "The message field is required." });
      return;
    }

    const topK = Number.isInteger(req.body.topK) ? req.body.topK : 3;
    const matches = await searchVectorStore(message, topK);
    const reply = matches.length
      ? await generateRetrievalReply(
          message,
          matches.map((match) => ({
            title: match.title,
            text: match.text
          }))
      )
      : await generateNursingReply(message);
    saveConversationTurn(message, reply, "retrieval");

    res.json({
      reply,
      vectorStoreReady: isVectorStoreReady(),
      matches: matches.map((match) => ({
        id: match.id,
        title: match.title,
        score: Number(match.score.toFixed(4)),
        metadata: match.metadata ?? null
      }))
    });
  })
);

app.post(
  "/api/embeddings",
  wrapRoute(async (req, res) => {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    const metadata =
      req.body.metadata &&
      typeof req.body.metadata === "object" &&
      !Array.isArray(req.body.metadata)
        ? req.body.metadata
        : null;

    if (!text) {
      res.status(400).json({ error: "The text field is required." });
      return;
    }

    const result = await generateEmbedding(text, metadata);
    res.json(result);
  })
);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Nurse AI backend listening on port ${config.port}`);
});
