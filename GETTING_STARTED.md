# 🚀 Getting Started in 5 Minutes

This guide will get you from zero to working authentication in **5 minutes**.

## ⏱️ Timer: Start Now!

## Step 1: Install Dependencies (2 min)

**Open PowerShell and run:**
```powershell
cd "C:\Users\user\Desktop\AI assistant\nurse-ai"
npm install
cd backend
npm install
cd ../frontend
npm install
cd ..
```

## Step 2: Create `.env` Files (1 min)

**Copy the example files:**

**Backend:**
```powershell
Copy-Item "backend\.env.example" "backend\.env"
```

**Frontend:**
```powershell
Copy-Item "frontend\.env.example" "frontend\.env"
```

## Step 3: Add MongoDB Connection (1 min)

### Option A: Quick Test (No Database Needed)
Skip this - keep MONGO_URI empty to test locally

### Option B: Use Cloud MongoDB (Recommended)
1. Go to: https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Click **Connect** → **Drivers** → Copy connection string
5. Open `backend\.env` and paste:
```env
MONGO_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/nursing-ai?retryWrites=true&w=majority
```

## Step 4: Add JWT Secret (0 min - Auto)
The file already has a placeholder. For production, change it:
```env
JWT_SECRET=ChangeMeToSomethingSecure123!
```

## Step 5: Start Backend (1 min)

**Open a new PowerShell window and run:**
```powershell
cd "C:\Users\user\Desktop\AI assistant\nurse-ai"
npm run dev
```

**Wait for this message:**
```
✅ Server running on port 3001
```

## Step 6: Start Frontend (Bonus)

**Open another PowerShell window and run:**
```powershell
cd "C:\Users\user\Desktop\AI assistant\nurse-ai\frontend"
npm run dev
```

**Browser should open to:** `http://localhost:5173`

## Step 7: Test Registration 🎉

1. Click **"Create account"**
2. Fill in:
   - Name: `John Doe`
   - Email: `john@example.com`
   - Password: `password123`
3. Click **Register**

**Success?** You're done! ✅

**Error?** Go to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 🎯 Commands Quick Reference

| What | Command |
|------|---------|
| Start backend | `npm run dev` |
| Start frontend | `cd frontend && npm run dev` |
| View backend logs | Check PowerShell window |
| View frontend logs | F12 → Console in browser |
| Kill backend | `Ctrl+C` in PowerShell |
| Check if running | `http://localhost:3001/health` in browser |

## 📂 Files You Created

```
backend/
├── .env                 ← You created this
frontend/
├── .env                 ← You created this
```

## ❓ Got "Failed to fetch"?

1. Make sure backend is running (see Step 5 output)
2. Check `frontend/.env` has correct `VITE_API_URL=http://localhost:3001`
3. Press `F12` in browser → Console for error details
4. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for full help

---

**⏱️ Did you make it in 5 minutes? Great!** 🚀

Next steps:
- [ ] Test login after registration
- [ ] Send a chat message
- [ ] Deploy to production (see [DEPLOYMENT.md](./AUTH_SETUP.md#-deployment))
