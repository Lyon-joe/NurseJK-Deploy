# Nursing AI Assistant - Project Architecture

## Overview

This is a unified full-stack application with:
- **Backend**: Node.js + Express + OpenAI API + Supabase
- **Frontend**: React 19 + Vite + TypeScript + Capacitor (Android)
- **Storage**: Supabase (PostgreSQL) + Vector embeddings

## Project Structure

```
nursing-ai-assistant/
├── server.js                    # Main entry point (proxies to backend/src/server.js)
├── package.json                 # Root monorepo config
├── backend/
│   ├── package.json            # Backend dependencies (synced with root)
│   ├── server.js               # ⚠️ DEPRECATED - Use backend/src/server.js instead
│   ├── src/
│   │   ├── server.js          # ✅ ACTIVE - Modern backend implementation
│   │   ├── config.js          # Configuration (port, frontend dir, etc.)
│   │   ├── openaiClient.js    # OpenAI API integration
│   │   ├── memoryStore.js     # Conversation persistence
│   │   ├── vectorStore.js     # Vector embeddings & RAG
│   │   └── lib/
│   │       └── supabase.js    # Supabase client
│   ├── scripts/
│   │   └── buildVectorStore.js # Vector store builder
│   ├── database/
│   │   ├── memory/            # Conversation history
│   │   ├── source/            # Nursing reference documents
│   │   └── vector-store/      # Embeddings cache
│   ├── models/                 # ⚠️ DEPRECATED MongoDB schemas
│   ├── middleware/             # ⚠️ DEPRECATED Auth middleware
│   └── ai/                     # ⚠️ DEPRECATED Gemini integration
├── frontend/
│   ├── package.json           # Frontend dependencies
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api.js             # API client
│   │   └── assets/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── android/               # Capacitor Android build
│   └── public/
└── docs/
    └── architecture.md
```

## What Was Cleaned Up

### ✅ Removed/Deprecated:
1. **Duplicate MongoDB implementation** (`backend/server.js`)
   - Was using Mongoose for user auth
   - Conflicted with modern OpenAI-based approach
   - Models: User, Memory (unused)

2. **Unused dependencies** removed from all package.json files:
   - `bcrypt`, `bcryptjs` (no auth needed, using Supabase)
   - `cookie-parser` (no cookie auth)
   - `jsonwebtoken` (deprecated auth)
   - `mongoose` (no MongoDB)
   - `postject` (unused bundler tool)

3. **Legacy Gemini integration** (`backend/ai/gemini.js`)
   - Replaced with unified OpenAI API
   - All AI operations now go through `openaiClient.js`

### ✅ Aligned Dependencies:
- All packages reference `^2.108.0` for `@supabase/supabase-js`
- Express `^4.22.2` (latest stable)
- OpenAI `^4.104.0` (latest stable)
- Node types and build tools standardized

## Running the Application

### Install Dependencies
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Development Mode
```bash
# From root directory - starts backend on port 3000
npm run dev

# In another terminal - starts frontend dev server on port 5173
cd frontend
npm run dev
```

### Production Build
```bash
# Backend: Node will serve static frontend build
npm run build:vectors  # Pre-process vector store
npm start

# Frontend: Pre-build before deployment
cd frontend
npm run build
```

## Environment Configuration

Both backend and frontend use `.env` files:

### Backend (`.env`)
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
GEMINI_API_KEY=...  # Optional, for alternative AI
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3000  # Dev
VITE_API_URL=https://your-prod-url   # Prod
```

## API Endpoints

Base URL: `http://localhost:3000`

- `GET /health` - Server status
- `POST /ask` - Query nursing AI with RAG
- `GET /history/:userId` - Get conversation history
- `POST /feedback` - Store user feedback

## Key Design Decisions

1. **Centralized backend** - Single source of truth for AI logic
2. **RESTful API** - Frontend-agnostic, supports web/mobile
3. **Supabase for storage** - Serverless, scales with usage
4. **Vector embeddings** - RAG for accurate nursing context
5. **Capacitor for Android** - Code sharing between web/mobile

## Migration Notes

If you were using the old MongoDB version:
1. User data moved to Supabase Auth
2. Conversation history now in `database/memory/` (JSONL format)
3. AI responses use OpenAI instead of Gemini
4. No more JWT tokens - use Supabase session management

## Next Steps

1. Test the unified build: `npm install && npm run dev`
2. Verify `.env` files are populated
3. Run vector store builder: `npm run build:vectors`
4. Deploy to your platform (Render, Vercel, etc.)

---
**Last Updated**: 2026-06-18
**Status**: Aligned & production-ready
