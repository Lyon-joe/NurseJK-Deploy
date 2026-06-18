# Nursing AI Assistant - Full Setup with Multi-User Authentication

**Status**: MongoDB + JWT Authentication enabled for Web & Mobile (APK)

## 📋 Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **MongoDB** (Cloud: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | Local: [MongoDB Community](https://www.mongodb.com/try/download/community))
- **npm** or **yarn** package manager

## 🔧 Environment Setup

### 1. Backend Configuration (`backend/.env`)

```env
# MongoDB Connection
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/nursing-ai?retryWrites=true&w=majority

# JWT Secret (generate a random string, e.g., openssl rand -hex 32)
JWT_SECRET=your-super-secret-jwt-key-here-change-this

# Gemini API (optional, for alternative AI)
GEMINI_API_KEY=your-gemini-key-here

# OpenAI API (if using OpenAI instead)
OPENAI_API_KEY=sk-your-key-here

# Server Port
PORT=3001
```

### 2. Frontend Configuration (`frontend/.env`)

```env
# Backend API URL
VITE_API_URL=http://localhost:3001
```

## 🚀 Installation & Running

### Step 1: Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Start Backend Server

```bash
# Terminal 1 - From project root
npm run dev

# Or from backend directory
cd backend
npm start
```

**Expected output:**
```
Server running on port 3001
MongoDB connected
```

### Step 3: Start Frontend (Web)

```bash
# Terminal 2 - From frontend directory
cd frontend
npm run dev

# Open browser to http://localhost:5173
```

## 🔐 Authentication Flow

### New User Registration

1. Click **"Create account"** on login screen
2. Enter:
   - Full Name
   - Email
   - Password (min. 6 characters)
3. System creates user in MongoDB
4. Password is hashed with bcrypt
5. JWT token issued and stored locally

### Existing User Login

1. Enter email & password
2. Backend verifies credentials
3. JWT token issued on success
4. Token stored in `localStorage`
5. All API calls include token in `Authorization` header

### Token Management

- **Stored in**: `localStorage` (key: `authToken`)
- **Expires**: Based on backend configuration (typically 7 days)
- **Auto-logout**: When token expires or becomes invalid
- **Refresh**: Token updated on each login

## 📱 Mobile APK Build (Android)

### Prerequisites

- Android Studio installed
- JDK 11+
- Android SDK 31+

### Build Steps

```bash
# From frontend directory
cd frontend

# Install Capacitor dependencies
npm install @capacitor/android @capacitor/cli

# Build web assets
npm run build

# Initialize Capacitor
npx cap init

# Add Android platform
npx cap add android

# Open Android Studio
npx cap open android

# In Android Studio:
# 1. Build → Build Bundle(s) / APK(s) → Build APK(s)
# 2. APK will be generated in: android/app/build/outputs/apk/debug/
```

### Configure API URL for Mobile

Update `frontend/src/context/AuthContext.tsx`:

```typescript
// For production APK, use your backend URL:
const API_URL = 'https://your-production-api.com';

// Or use environment detection:
const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://your-production-api.com');
```

## 🔄 API Endpoints

### Authentication

| Method | Endpoint | Payload |
|--------|----------|---------|
| `POST` | `/api/auth/register` | `{ name, email, password }` |
| `POST` | `/api/auth/login` | `{ email, password }` |
| `GET` | `/api/protected` | Headers: `{ Authorization: Bearer <token> }` |

**Responses:**

Register Success:
```json
{
  "message": "User created successfully",
  "userId": "507f1f77bcf86cd799439011",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Login Success:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Chat

| Method | Endpoint | Requires Auth |
|--------|----------|---------------|
| `POST` | `/api/chat/retrieval` | ✅ Yes |
| `GET` | `/api/conversations` | ✅ Yes |
| `GET` | `/api/dashboard/performance` | ✅ Yes |

## 🗄️ Database Schema (MongoDB)

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  createdAt: Date,
  updatedAt: Date
}
```

### Memory Collection (Conversations)

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  messages: [
    {
      role: 'user' | 'ai',
      content: String
    }
  ],
  weakTopics: [String],
  createdAt: Date,
  updatedAt: Date
}
```

## 🧪 Testing Authentication

### Using cURL (Backend)

**Register:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Protected Route:**
```bash
curl -X GET http://localhost:3001/api/protected \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## 🐛 Troubleshooting

### "MongoDB connected" fails

- **Issue**: Database connection string incorrect
- **Fix**: Verify `MONGO_URI` in `backend/.env`
  - For Atlas: Include username, password, cluster, and retry settings
  - For Local: Use `mongodb://localhost:27017/nursing-ai`
- **Test**: `mongo "your-connection-string"`

### "Login failed" / Token not working

- **Issue**: JWT_SECRET changed or expired token
- **Fix**: 
  - Verify `JWT_SECRET` is set in `.env`
  - Clear `localStorage` and re-login
  - Check token expiry in `backend/server.js`

### CORS errors on frontend

- **Issue**: Frontend URL not in CORS whitelist
- **Fix**: Update `cors()` config in `backend/server.js`:
  ```javascript
  app.use(cors({
    origin: [
      "http://localhost:5173",    // Vite dev
      "http://localhost:3000",    // Alternative
      "https://your-domain.com"   // Production
    ],
    credentials: true
  }));
  ```

### APK doesn't connect to backend

- **Issue**: Hardcoded localhost URL in APK
- **Fix**: 
  - Set `VITE_API_URL=https://your-backend-url` before build
  - Use dynamic URL detection in `AuthContext.tsx`

## 📊 User Metrics & Weak Topic Tracking

The system automatically:

1. **Tracks weak topics** from user questions
2. **Stores conversation history** per user
3. **Provides performance dashboard** with tracked topics
4. **Personalizes responses** based on learning gaps

### Access Weak Topics:
- Frontend shows in sidebar: "Tracked Review Topics"
- API endpoint: `GET /api/dashboard/performance` (requires token)

## 🚀 Deployment

### Backend Deployment (Render, Heroku, Railway)

1. Push code to GitHub
2. Connect to deployment platform
3. Set environment variables:
   - `MONGO_URI` (MongoDB Atlas)
   - `JWT_SECRET` (secure random string)
   - `GEMINI_API_KEY` (if needed)
   - `NODE_ENV=production`
4. Deploy!

### Frontend Deployment (Vercel, Netlify)

```bash
cd frontend
npm run build

# Deploy 'dist' folder to your platform
```

Environment variable: `VITE_API_URL=https://your-backend-api.com`

## 📚 File Structure

```
nursing-ai-assistant/
├── backend/
│   ├── server.js              # ✅ ACTIVE - Main server (MongoDB + JWT)
│   ├── models/
│   │   ├── user.js           # User schema
│   │   └── Memory.js         # Conversation schema
│   ├── middleware/
│   │   └── auth.js           # JWT verification
│   ├── ai/
│   │   └── gemini.js         # AI integration
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main app component
│   │   ├── context/
│   │   │   └── AuthContext.tsx   # Auth state management
│   │   ├── components/
│   │   │   ├── Login.tsx      # Login UI
│   │   │   ├── Register.tsx   # Register UI
│   │   │   └── ProtectedRoute.tsx
│   │   ├── api/
│   │   │   └── client.ts      # API utilities
│   │   └── styles/
│   │       └── Auth.css       # Auth styling
│   └── package.json
└── server.js                  # Entry point
```

---

**Status**: 🟢 Production Ready  
**Last Updated**: 2026-06-18
**Multi-User**: ✅ Enabled
**Mobile (APK)**: ✅ Supported
**Web**: ✅ Full Featured
