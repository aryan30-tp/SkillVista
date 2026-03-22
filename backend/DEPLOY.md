# Deployment Guide: Render + MongoDB Atlas

## 🔒 Security Checklist

✅ **Environment Variables**: Your MongoDB credentials are stored in `.env` (NOT committed to git)  
✅ **.gitignore**: `.env` is in [.gitignore](.gitignore), credentials will never leak  
✅ **.env.example**: Safe template with placeholders for team setup  

### CRITICAL: Before Each Push
```bash
# Verify .env is NOT listed in git
git status

# If .env appears, remove it from git history immediately
git rm --cached .env
git commit -m "Remove .env from git history"
```

---

## 📋 Prerequisites

1. **MongoDB Atlas Account**: ✅ You have your connection string
2. **Render Account**: Sign up at https://render.com (free tier available)
3. **GitHub Account**: Already linked
4. **Local Testing**: Verify backend works before deploying

---

## 🚀 Step 1: Test Backend Locally

```bash
cd backend

# Install dependencies (already done)
npm install

# Start server - should connect to MongoDB
npm start
```

**Expected output:**
```
[development] Server listening on port 5000
✅ MongoDB connected successfully
```

If you see a connection error, verify your MongoDB connection string in `.env`.

---

## 🌐 Step 2: Deploy to Render

### 2.1 Connect GitHub to Render
1. Go to https://render.com and sign in
2. Click **"New +"** → **"Web Service"**
3. Select **"Connect a repository"**
4. Choose your GitHub repo: `aryan30-tp/SkillVista`
5. Authorize Render to access your GitHub

### 2.2 Configure Service
- **Name**: `skillvista-backend` (or your choice)
- **Root Directory**: `backend`
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 2.3 Add Environment Variables
In Render dashboard, go to **Environment** section and add:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Production mode |
| `MONGODB_URI` | `mongodb+srv://aryan30n_db_user:bVJNleq6EkvVQn3c@cluster0.frvlxzk.mongodb.net/?appName=Cluster0` | Your connection string |
| `PORT` | *Leave blank* | Render assigns automatically |

**⚠️ WARNING**: Paste your credential string into Render's dashboard (NOT in code). Render keeps environment variables encrypted and separate from source code.

### 2.4 Deploy
1. Click **"Create Web Service"**
2. Render will auto-deploy when you push to main
3. Watch the deploy logs in the **"Events"** tab
4. Once deployed, you'll get a URL like: `https://skillvista-backend.render.com`

---

## ✅ Step 3: Verify Deployment

Test your live API:
```bash
curl https://skillvista-backend.render.com/
curl https://skillvista-backend.render.com/api/health
```

Expected responses:
```json
{"message":"SkillVista backend is running"}
{"ok":true,"service":"skillvista-backend","timestamp":"2026-03-22T..."}
```

---

## 🔄 Continuous Deployment

From now on:
1. Push changes to main: `git push origin main`
2. Render **automatically redeploys**
3. Check logs in Render dashboard if issues occur

---

## 🐛 Troubleshooting

### "MongoDB connection failed"
- Verify `MONGODB_URI` is set in Render environment variables
- Check MongoDB Atlas: Whitelist Render IP in Network Access
  - Go to MongoDB Atlas console
  - Security → Network Access → Add IP Address
  - Allow: `0.0.0.0/0` (for Render's dynamic IPs) or add Render's IP after first error logs

### "Port already in use"
- Render handles port assignment automatically; should not occur

### "Build failed"
- Check **Events** tab in Render for build logs
- Ensure [package.json](package.json) has correct `"start"` script

---

## 📺 Next Steps

1. **Test endpoints**: Use Postman or curl to test your API from the live URL
2. **Add auth routes**: Once API works, add login/register endpoints
3. **Connect frontend**: Update React Native app to call `https://skillvista-backend.render.com` instead of localhost
4. **Monitor**: Check Render logs occasionally for issues

---

## 🔐 Important Security Notes

- **Never commit `.env`**: It's in `.gitignore`, but double-check with `git status`
- **Rotate credentials occasionally**: Change MongoDB password in Atlas
- **Keep dependencies updated**: Run `npm audit` in backend folder
- **Use Render's free tier limits**: Check https://render.com/pricing for current limits

---

**Questions?** Check Render docs: https://render.com/docs
