import fs from "node:fs";
import { config } from "./config.js";

const recentTurnLimit = 8;

function ensureMemoryDir() {
  fs.mkdirSync(config.memoryDir, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function formatItems(items) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }

  return items
    .map((item) => `- ${item.text}${item.evidence ? ` Evidence: ${item.evidence}` : ""}`)
    .join("\n");
}

function readRecentTurns() {
  if (!fs.existsSync(config.conversationMemoryPath)) {
    return [];
  }

  const lines = fs
    .readFileSync(config.conversationMemoryPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-recentTurnLimit);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function readAllTurns() {
  if (!fs.existsSync(config.conversationMemoryPath)) {
    return [];
  }

  return fs
    .readFileSync(config.conversationMemoryPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildTitle(message) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 52 ? `${compact.slice(0, 49)}...` : compact;
}

export function listConversationTurns(limit = 30) {
  return readAllTurns()
    .slice(-limit)
    .reverse()
    .map((turn, index) => ({
      id: `${turn.createdAt}-${index}`,
      title: buildTitle(turn.userMessage || "Untitled conversation"),
      createdAt: turn.createdAt,
      mode: turn.mode || "chat",
      userMessage: turn.userMessage || "",
      assistantReply: turn.assistantReply || ""
    }));
}

export function getMemoryContext() {
  const profile = readJsonFile(config.profileMemoryPath, {});
  const sections = [];

  const demographics = formatItems(profile.demographics);
  const preferences = formatItems(profile.interestsAndPreferences);
  const projects = formatItems(profile.projectsAndPlans);
  const instructions = formatItems(profile.instructions);
  const recentTurns = readRecentTurns();

  if (demographics) {
    sections.push(`User profile:\n${demographics}`);
  }

  if (preferences) {
    sections.push(`User interests and preferences:\n${preferences}`);
  }

  if (projects) {
    sections.push(`Current projects and plans:\n${projects}`);
  }

  if (instructions) {
    sections.push(`Standing instructions:\n${instructions}`);
  }

  if (recentTurns.length) {
    sections.push(
      `Recent local conversations:\n${recentTurns
        .map((turn) => `- User: ${turn.userMessage}\n  Assistant: ${turn.assistantReply}`)
        .join("\n")}`
    );
  }

  if (!sections.length) {
    return "";
  }

  return `Private memory for personalization. Use only when relevant, do not reveal or recite this memory unless the user asks for it.\n\n${sections.join("\n\n")}`;
}

export function saveConversationTurn(userMessage, assistantReply, mode = "chat") {
  ensureMemoryDir();

  const compactReply =
    assistantReply.length > 800 ? `${assistantReply.slice(0, 800).trim()}...` : assistantReply;

  const record = {
    createdAt: new Date().toISOString(),
    mode,
    userMessage,
    assistantReply: compactReply
  };

  fs.appendFileSync(
    config.conversationMemoryPath,
    `${JSON.stringify(record)}\n`,
    "utf8"
  );
}
