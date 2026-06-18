# Quick Command Reference - Nursing AI Assistant

## 🚀 First Time Setup

```bash
# 1. Install all dependencies
npm install && cd backend && npm install && cd ../frontend && npm install && cd ..

# 2. Create .env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Edit .env files with your credentials
# - MONGO_URI in backend/.env
# - VITE_API_URL in frontend/.env

# 4. Start backend
npm run dev

# 5. Start frontend (in another terminal)
cd frontend && npm run dev
```

## 📝 Environment Variables

### Backend (.env)
```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/nursing-ai
JWT_SECRET=your-random-secret-key
GEMINI_API_KEY=optional-gemini-key
OPENAI_API_KEY=optional-openai-key
PORT=3001
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
```

## 🎯 Development Commands

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | root | Start backend dev server |
| `npm run dev` | frontend/ | Start frontend dev server |
| `npm run lint` | root/frontend/ | Run ESLint |
| `npm run type-check` | root/frontend/ | Check TypeScript |
| `npm run build:vectors` | root | Build vector embeddings |

## 🔐 Authentication Test

### Web Browser
1. Go to `http://localhost:5173`
2. Click "Create account"
3. Register with email & password
4. Login to access chat

### cURL Commands

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

**Protected Route (use token from login response):**
```bash
curl -X GET http://localhost:3001/api/protected \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Send Chat Message:**
```bash
curl -X POST http://localhost:3001/api/chat/retrieval \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "message": "What is hypertension?"
  }'
```

## 🏗️ Building for Production

### Backend Build
```bash
# No build needed, runs directly with Node
# Just set environment variables and run:
npm start
```

### Frontend Build
```bash
cd frontend
npm run build
# Output goes to: frontend/dist/

# Preview build:
npm run preview
```

### Docker (Optional)

**Dockerfile for backend:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN cd backend && npm install
EXPOSE 3001
CMD ["npm", "start"]
```

## 📱 Mobile APK Build

```bash
cd frontend

# Build web assets
npm run build

# Add Android platform
npx cap add android

# Build APK
npx cap build android

# APK location:
# frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔍 MongoDB Connection Issues

```bash
# Test local MongoDB connection
mongosh "mongodb://localhost:27017"

# Test Atlas connection
mongosh "mongodb+srv://username:password@cluster.mongodb.net"

# View collections
db.getCollectionNames()

# Check users
db.users.find({})

# Check conversation memory
db.memories.find({})
```

## 🧹 Cleaning Up

```bash
# Remove node_modules and reinstall
rm -rf node_modules backend/node_modules frontend/node_modules
npm install && cd backend && npm install && cd ../frontend && npm install

# Clear browser cache/localStorage
# In browser console: localStorage.clear()

# Remove old build files
rm -rf frontend/dist
rm -rf backend/build
```

## 🐛 Common Issues

### Backend won't start
```bash
# Check if port 3001 is in use
lsof -i :3001  # Mac/Linux
netstat -ano | findstr :3001  # Windows

# Kill process and try again
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### MongoDB authentication fails
```bash
# Verify connection string format:
mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority

# Special characters in password? Encode them:
# @ = %40, : = %3A, etc.
# Or use MongoDB Atlas to generate connection string
```

### Frontend can't reach backend
```bash
# Check backend is running:
curl http://localhost:3001/

# Check VITE_API_URL in frontend/.env:
VITE_API_URL=http://localhost:3001

# Clear browser cache and reload
```

## 📊 Monitoring

### View Backend Logs
```bash
# With timestamps
npm run dev 2>&1 | tee backend.log

# Watch logs
tail -f backend.log
```

### Database Stats
```bash
mongosh > db.stats()
db.users.countDocuments()
db.memories.countDocuments()
```

## 🚀 Deployment Platforms

### Render.com
```bash
# 1. Push to GitHub
# 2. Create new Web Service on Render
# 3. Set environment variables (MONGO_URI, JWT_SECRET)
# 4. Deploy!

# Start command: npm start
# Build command: npm install && cd backend && npm install
```

### Vercel (Frontend only)
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy from frontend directory
cd frontend
vercel

# 3. Set VITE_API_URL to your backend URL
```

### Railway
```bash
# 1. Connect GitHub repo
# 2. Set environment variables
# 3. Railway auto-deploys on push
```

## 📞 Quick Links

- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas
- **Render**: https://render.com
- **Vercel**: https://vercel.com
- **Railway**: https://railway.app
- **Node.js**: https://nodejs.org

---

**Always keep .env files out of version control!**
