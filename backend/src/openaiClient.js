import { config } from "./config.js";
import { getMemoryContext } from "./memoryStore.js";
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

async function createOpenAiResponse(systemPrompt, userMessage) {
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

function readGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const reply = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!reply) {
    throw new Error("Gemini API returned an empty response.");
  }

  return reply;
}

async function createGeminiResponse(systemPrompt, userMessage) {
  if (!config.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment.");
  }

  const modelPath = geminiModelPath(config.geminiChatModel);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `${userMessage}${buildSafetySuffix(userMessage)}` }]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
  }

  return readGeminiText(await response.json());
}

async function createResponse(systemPrompt, userMessage) {
  const memoryContext = getMemoryContext();
  const promptWithMemory = memoryContext
    ? `${systemPrompt}\n\n${memoryContext}`
    : systemPrompt;

  return config.chatProvider.toLowerCase() === "gemini"
    ? createGeminiResponse(promptWithMemory, userMessage)
    : createOpenAiResponse(promptWithMemory, userMessage);
}

function readEmbeddingValues(data) {
  const embedding =
    data.data?.[0]?.embedding ??
    data.embedding?.values ??
    data.embeddings?.[0]?.values;

  if (!Array.isArray(embedding)) {
    throw new Error("Embedding provider returned an invalid response.");
  }

  return embedding;
}

function geminiModelPath(model) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

async function generateOpenAiEmbedding(text) {
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

  return {
    model: config.openAiEmbeddingModel,
    embedding: readEmbeddingValues(await response.json())
  };
}

async function generateGeminiEmbedding(text) {
  if (!config.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment.");
  }

  const modelPath = geminiModelPath(config.geminiEmbeddingModel);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${modelPath}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey
      },
      body: JSON.stringify({
        model: modelPath,
        content: {
          parts: [{ text }]
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
  }

  return {
    model: config.geminiEmbeddingModel,
    embedding: readEmbeddingValues(await response.json())
  };
}

export async function generateNursingReply(userMessage) {
  return createResponse(nurseSystemPrompt, userMessage);
}

export async function generateRetrievalReply(userMessage, contextBlocks) {
  return createResponse(buildRetrievalPrompt(contextBlocks), userMessage);
}

export async function generateEmbedding(text, metadata = null) {
  const provider = config.embeddingProvider.toLowerCase();
  const result =
    provider === "gemini"
      ? await generateGeminiEmbedding(text)
      : await generateOpenAiEmbedding(text);

  return {
    provider,
    model: result.model,
    text,
    embedding: result.embedding,
    metadata
  };
}
