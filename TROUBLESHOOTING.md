# Troubleshooting Guide - "Failed to fetch" Error

## 🔍 Quick Diagnosis

If you see **"Failed to fetch"** when trying to register or login, follow these steps:

## Step 1: Check Backend is Running ✅

**In PowerShell, run:**
```powershell
npm run dev
```

**You should see output like:**
```
✅ MongoDB connected  (or ⚠️ MongoDB URI not set - which is fine for testing)
✅ Server running on port 3001
📝 API: http://localhost:3001
🔐 Register: POST http://localhost:3001/api/auth/register
🔑 Login: POST http://localhost:3001/api/auth/login
```

**If backend doesn't start:**
- Error: `Command not found`?
  - Run `npm install` first
  - Then `npm run dev`

- Error: `Port 3001 already in use`?
  - Edit `backend/.env` and change `PORT=3002`
  - Update `frontend/.env` to match: `VITE_API_URL=http://localhost:3002`

## Step 2: Check `.env` Files Exist 📝

**Backend** - Check if `backend/.env` exists:
```powershell
Test-Path "backend\.env"
```

**If missing, create it:**
```powershell
Copy-Item "backend\.env.example" "backend\.env"
```

**Frontend** - Check if `frontend/.env` exists:
```powershell
Test-Path "frontend\.env"
```

**If missing, create it:**
```powershell
Copy-Item "frontend\.env.example" "frontend\.env"
```

## Step 3: Check MongoDB URI (Most Common Issue) 🗄️

**In `backend/.env`, verify:**
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/nursing-ai?retryWrites=true&w=majority
JWT_SECRET=your-secret-key
```

**If MONGO_URI is missing or empty:**

### Option A: Use MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account (no credit card needed)
3. Create cluster
4. Click "Connect"
5. Choose "Drivers" → "Node.js"
6. Copy connection string: `mongodb+srv://...`
7. Replace `<password>` with your password
8. Replace `<username>` with your username
9. Paste into `backend/.env` as `MONGO_URI=...`

### Option B: Use MongoDB Locally
1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Start MongoDB service
3. Set in `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/nursing-ai
```

### Option C: Test Without MongoDB (Temporary)
For testing authentication flow without database:
1. Leave `MONGO_URI` empty in `.env`
2. Backend will show warning but still run
3. You can test the API endpoints
4. Registration will fail at database stage with specific error

## Step 4: Check JWT_SECRET ✅

**In `backend/.env`, verify JWT_SECRET is set:**
```env
JWT_SECRET=somethingSecret123
```

**If missing, generate one:**

**PowerShell:**
```powershell
# Generate random 32-char key
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Or use online generator:** https://generatedata.com

## Step 5: Verify API URL 🌐

**In `frontend/.env`, check:**
```env
VITE_API_URL=http://localhost:3001
```

**If you changed the backend port, update this too!**

### Test API Connection from Browser Console

1. Open browser: `http://localhost:5173`
2. Press `F12` to open DevTools
3. Go to "Console" tab
4. Run:
```javascript
fetch('http://localhost:3001/health')
  .then(r => r.json())
  .then(data => console.log('✅ Backend OK:', data))
  .catch(err => console.error('❌ Backend Error:', err))
```

**Expected output:**
```
✅ Backend OK: {
  status: "ok",
  service: "nursing-ai-backend",
  mongoConnected: true
}
```

**If error shows:**
- `Failed to fetch` → Backend not running
- `CORS error` → Check backend CORS settings
- `mongoConnected: false` → MongoDB URI issue

## Step 6: Clear Browser Cache 🔄

Sometimes old data causes issues:

1. Press `F12` in browser
2. Right-click refresh button → "Empty cache and hard refresh"
3. Or: `Ctrl+Shift+Delete` → Clear all data

## Step 7: Check Console Logs 📊

**Backend Console** (where you ran `npm run dev`):
- Look for any error messages
- Copy and paste them below

**Frontend Console** (F12 in browser):
- Go to Console tab
- Look for any red errors
- Take screenshot

## Quick Checklist

```
Frontend Setup:
□ npm install (from root)
□ frontend/.env exists with VITE_API_URL=http://localhost:3001
□ npm run dev working (from frontend folder)
□ Browser shows login page at http://localhost:5173

Backend Setup:
□ npm install (from backend folder)
□ backend/.env exists
□ MONGO_URI set OR intentionally empty (for testing)
□ JWT_SECRET set
□ npm run dev working (from root)
□ Shows "Server running on port 3001"
□ Shows "✅ MongoDB connected" OR "⚠️ MongoDB URI not set"

API Check:
□ http://localhost:3001/health works (test in browser)
□ Returns JSON with status: "ok"
□ CORS allows http://localhost:5173

Registration Flow:
□ Enter name, email, password
□ Click Register
□ Check browser DevTools Console for errors
□ Check backend console for errors
```

## Common Error Messages & Fixes

### "Failed to fetch"
**Cause:** Backend not running or wrong URL
```powershell
# Make sure backend is running
npm run dev
```

### "CORS policy error"
**Cause:** Frontend origin not in backend CORS whitelist
**Fix:** Edit `backend/server.js` line 28, add your frontend URL:
```javascript
origin: [
  "http://localhost:5173",
  "http://localhost:3000",
  "YOUR_FRONTEND_URL_HERE"
]
```

### "MongoServerError: connect ECONNREFUSED"
**Cause:** MongoDB not running or wrong connection string
**Fix:** 
- Check MONGO_URI is correct
- Or install & start MongoDB locally
- Or get connection string from MongoDB Atlas

### "SyntaxError: Unexpected token < in JSON"
**Cause:** Backend returned HTML instead of JSON (404 error)
**Fix:** Check endpoint URL is correct in frontend

### "jwt malformed"
**Cause:** JWT_SECRET changed or not set
**Fix:** Make sure JWT_SECRET is same when backend starts

## Still Not Working? 🆘

Provide this information:

1. **Backend console output** (from `npm run dev`):
   - Copy all text shown

2. **Frontend console errors** (F12 → Console):
   - Screenshot of any red errors

3. **Your environment**:
   ```powershell
   npm --version
   node --version
   ```

4. **File check**:
   ```powershell
   Test-Path "backend\.env"
   Test-Path "frontend\.env"
   ```

5. **Port check** (see what's using port 3001):
   ```powershell
   netstat -ano | findstr :3001
   ```

---

**Remember:** Most "Failed to fetch" errors = Backend not running or wrong API URL!

Start with Step 1 and work through systematically. 🎯
