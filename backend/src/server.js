import http from "node:http";
import { config } from "./config.js";
import {
  generateEmbedding,
  generateNursingReply,
  generateRetrievalReply
} from "./openaiClient.js";
import { searchVectorStore } from "./vectorStore.js";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendJson(res, 400, { error: "Invalid request." });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "nurse-ai-backend"
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      const body = await parseJsonBody(req);
      const message = typeof body.message === "string" ? body.message.trim() : "";

      if (!message) {
        sendJson(res, 400, { error: "The message field is required." });
        return;
      }

      const reply = await generateNursingReply(message);

      sendJson(res, 200, { reply });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error."
      });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat/retrieval") {
    try {
      const body = await parseJsonBody(req);
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const topK = Number.isInteger(body.topK) ? body.topK : 3;

      if (!message) {
        sendJson(res, 400, { error: "The message field is required." });
        return;
      }

      const matches = await searchVectorStore(message, topK);
      const reply = await generateRetrievalReply(
        message,
        matches.map((match) => ({
          title: match.title,
          text: match.text
        }))
      );

      sendJson(res, 200, {
        reply,
        matches: matches.map((match) => ({
          id: match.id,
          title: match.title,
          score: Number(match.score.toFixed(4)),
          metadata: match.metadata ?? null
        }))
      });
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error."
      });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/embeddings") {
    try {
      const body = await parseJsonBody(req);
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const metadata =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? body.metadata
          : null;

      if (!text) {
        sendJson(res, 400, { error: "The text field is required." });
        return;
      }

      const result = await generateEmbedding(text, metadata);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error."
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Route not found." });
});

server.listen(config.port, () => {
  console.log(`Nurse AI backend listening on port ${config.port}`);
});
