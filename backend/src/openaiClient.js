import { config } from "./config.js";
import { buildRetrievalPrompt, nurseSystemPrompt } from "./nursePrompt.js";

function buildSafetySuffix(userMessage) {
  const emergencyKeywords = [
    "chest pain",
    "shortness of breath",
    "seizure",
    "unconscious",
    "severe bleeding",
    "stroke",
    "suicidal"
  ];

  const lowered = userMessage.toLowerCase();
  const hasEmergencySignal = emergencyKeywords.some((keyword) =>
    lowered.includes(keyword)
  );

  if (!hasEmergencySignal) {
    return "";
  }

  return "\n\nAdd a brief urgent warning to seek immediate in-person medical help or emergency services.";
}

async function createResponse(systemPrompt, userMessage) {
  if (!config.openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiModel,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `${userMessage}${buildSafetySuffix(userMessage)}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const reply = data.output_text?.trim();

  if (!reply) {
    throw new Error("OpenAI API returned an empty response.");
  }

  return reply;
}

export async function generateNursingReply(userMessage) {
  return createResponse(nurseSystemPrompt, userMessage);
}

export async function generateRetrievalReply(userMessage, contextBlocks) {
  return createResponse(buildRetrievalPrompt(contextBlocks), userMessage);
}

export async function generateEmbedding(text, metadata = null) {
  if (!config.openAiApiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: JSON.stringify({
      model: config.openAiEmbeddingModel,
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI API returned an invalid embedding response.");
  }

  return {
    model: config.openAiEmbeddingModel,
    text,
    embedding,
    metadata
  };
}
