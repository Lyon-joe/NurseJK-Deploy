# Quick Start Guide

## 📋 Prerequisites
- Node.js 18+ (check with `node -v`)
- npm 9+ (check with `npm -v`)

## 🚀 Setup & Run

### 1. Install Dependencies
```bash
# Install root + backend + frontend in one go
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure Environment
Copy `.env.example` files (or create new ones):

**`backend/.env`**
```
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
PORT=3000
```

**`frontend/.env`** (optional, defaults to localhost:3000)
```
VITE_API_URL=http://localhost:3000
```

### 3. Start Development

**Terminal 1 - Backend:**
```bash
npm run dev
# Output: Server running on http://localhost:3000
```

**Terminal 2 - Frontend (optional, for web UI):**
```bash
cd frontend
npm run dev
# Output: Vite dev server on http://localhost:5173
```

### 4. Build for Production

**Backend:**
```bash
npm run build:vectors    # Pre-process embeddings
npm start                # Runs on PORT from .env
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## 📁 What's What

| File/Folder | Purpose |
|---|---|
| `server.js` | Entry point (proxies to active backend) |
| `backend/src/` | Active backend code (Express + OpenAI) |
| `backend/server.js` | ⚠️ DEPRECATED - do not use |
| `frontend/` | React app (Vite + TS) |
| `backend/scripts/buildVectorStore.js` | RAG vector builder |
| `.env` | Secrets (add to `.gitignore`, never commit) |

## 🧪 Testing the Setup

```bash
# Check backend is running
curl http://localhost:3000/health
# Should return: { "status": "ok", "service": "nurse-ai-backend", ... }

# Check frontend is running (from browser)
# Navigate to http://localhost:5173
```

## 🔧 Common Commands

```bash
# Lint code
npm run lint

# Type-check TypeScript
npm run type-check

# Run vector store builder
npm run build:vectors

# Start production server
npm start
```

## 🐛 Troubleshooting

**Port 3000 already in use?**
```bash
# Change PORT in backend/.env
PORT=3001 npm run dev
```

**Missing OPENAI_API_KEY?**
- Get key from https://platform.openai.com/api-keys
- Add to `backend/.env`
- Restart backend

**Frontend can't reach backend?**
- Check `VITE_API_URL` in `frontend/.env` matches backend URL
- Make sure backend is running on the correct port

**CORS errors?**
- Edit `backend/src/server.js` and update the `cors()` configuration
- Ensure origin matches your frontend URL

## 📚 Learn More

- [Architecture docs](./ARCHITECTURE.md)
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)

---

**All systems aligned to mainstream 🎯**
