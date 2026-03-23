# Nurse AI Backend

Node.js backend API for a nursing AI chatbot.

## Features

- `GET /health` for service health checks
- `POST /api/chat` for chatbot responses
- `POST /api/embeddings` for embedding generation
- `POST /api/chat/retrieval` for retrieval-augmented chatbot responses
- Nursing-specific system prompt with a fixed response format
- Basic request validation and emergency-safety language
- Local JSON vector store ingestion for nursing notes

## Requirements

- Node.js 18 or newer
- An `OPENAI_API_KEY`

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your OpenAI API key
3. Start the server:

```bash
npm start
```

## Build The Knowledge Base

1. Put your nursing source text in:

```text
database/source/nursing-notes.txt
```

2. Generate chunks and embeddings:

```bash
node scripts/buildVectorStore.js
```

This creates:

```text
database/vector-store/nursing-embeddings.json
```

## Architecture

See the system flow diagram and notes in [docs/architecture.md](C:\Users\user\Desktop\AI assistant\nurse-ai\docs\architecture.md).

```mermaid
flowchart TD
    A["User Query"] --> B["Embedding Model<br/>text-embedding-3-small"]
    B --> C["Vector Database Search"]
    C --> D["Top Matching Document Chunks"]
    D --> E["LLM<br/>OpenAI Responses API"]
    E --> F["Final Answer"]
```

## API

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

### `POST /api/chat`

Request body:

```json
{
  "message": "What is hypertension?"
}
```

Response:

```json
{
  "reply": "Definition\n..."
}
```

### `POST /api/embeddings`

Request body:

```json
{
  "text": "Hypertension management in older adults",
  "metadata": {
    "source": "NEUROLOGICAL NURSING-3.pdf",
    "topic": "Neurological nursing"
  }
}
```

Response:

```json
{
  "model": "text-embedding-3-small",
  "text": "Hypertension management in older adults",
  "embedding": [0.01, -0.02],
  "metadata": {
    "source": "NEUROLOGICAL NURSING-3.pdf",
    "topic": "Neurological nursing"
  }
}
```

### `POST /api/chat/retrieval`

Request body:

```json
{
  "message": "What is meningitis?",
  "topK": 3
}
```

Response:

```json
{
  "reply": "Definition\n...",
  "matches": [
    {
      "id": "chunk-1",
      "title": "Meningitis",
      "score": 0.87,
      "metadata": {
        "source": "nursing-notes.txt",
        "topic": "MENINGITIS"
      }
    }
  ]
}
```
