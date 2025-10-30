# Production Deployment Guide

## Overview

Your setup will be:
- **Backend (Railway)**: Hosts the API and serves the chat widget
- **Frontend (Hostinger)**: Your main website with embedded chat widget

---

## Part 1: Deploy Backend to Railway

### Step 1: Prepare Your Project

1. **Create a `.gitignore` file** (if not exists):
```
node_modules/
.env
data/raw/
*.log
.DS_Store
```

2. **Create a `Procfile`** (optional, Railway auto-detects):
```
web: npm run start
```

3. **Update `package.json` - Add start script**:
```json
"scripts": {
  "start": "tsx src/server.ts",
  "dev": "nodemon --watch src --exec tsx src/server.ts",
  "scrape": "tsx src/scrape.ts",
  "ingest": "tsx src/ingest.ts"
}
```

### Step 2: Initialize Git Repository

```bash
cd "C:\Users\incec\PycharmProjects\chatbot test\mile-chat-test"
git init
git add .
git commit -m "Initial commit - AnyCommand chatbot"
```

### Step 3: Deploy to Railway

1. **Go to Railway**: https://railway.app/
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Connect your GitHub account** (if not already)
5. **Create a new repo on GitHub**:
   - Go to https://github.com/new
   - Name it: `anycommand-chatbot`
   - Create repository (don't initialize with README)

6. **Push to GitHub**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/anycommand-chatbot.git
git branch -M main
git push -u origin main
```

7. **Back on Railway**:
   - Select your repository
   - Railway will auto-detect Node.js
   - Click "Deploy"

### Step 4: Configure Environment Variables in Railway

1. In Railway dashboard, go to your project
2. Click **"Variables"** tab
3. Add these variables:

```env
AI_API_KEY=your-openai-api-key-here
AI_BASE_URL=https://api.openai.com
AI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
SITE_URL=https://anycommand.io/
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Important**: Replace `ALLOWED_ORIGINS` with your actual Hostinger domain(s)!

### Step 5: Get Your Railway URL

1. After deployment, Railway will give you a URL like:
   ```
   https://anycommand-chatbot-production.up.railway.app
   ```
2. **Copy this URL** - you'll need it for the next steps

### Step 6: Upload Embeddings Data

Your chatbot needs the `data/embeddings.json` file. Two options:

**Option A: Include in Git** (if file is small):
```bash
# Remove data/ from .gitignore
git add data/embeddings.json
git commit -m "Add embeddings data"
git push
```

**Option B: Upload via Railway CLI** (recommended for larger files):
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Upload the file
railway run -- node -e "console.log('Embeddings uploaded')"
```

Or manually create the embeddings in production:
```bash
# SSH into Railway (via their dashboard)
npm run scrape
npm run ingest
```

---

## Part 2: Update Widget Configuration

### Step 7: Update widget.html for Production

Open `public/widget.html` and update the API URL:

```javascript
const CONFIG = {
  // Change this to your Railway URL
  apiUrl: 'https://anycommand-chatbot-production.up.railway.app/chat',
  
  // Keep the rest as is
  botName: 'AnyCommand Assistant',
  botSubtitle: 'Ask me anything!',
  welcomeTitle: 'Welcome!',
  welcomeMessage: "I'm here to help you learn about AnyCommand. Feel free to ask me any questions!",
};
```

**Commit and push**:
```bash
git add public/widget.html
git commit -m "Update API URL for production"
git push
```

Railway will automatically redeploy.

---

## Part 3: Embed Widget on Hostinger

### Step 8: Get the Widget URL

Your widget is now available at:
```
https://anycommand-chatbot-production.up.railway.app/widget.html
```

### Step 9: Add to Your Hostinger Website

**Method 1: Simple iframe (Easiest)**

Add this code to your website, right before the closing `</body>` tag:

```html
<!-- AnyCommand Chat Widget -->
<iframe 
  src="https://anycommand-chatbot-production.up.railway.app/widget.html" 
  style="position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;"
  allow="clipboard-write"
  title="Chat Widget"
></iframe>
```

**Method 2: JavaScript Dynamic Loading (Better for performance)**

```html
<!-- AnyCommand Chat Widget -->
<script>
(function() {
  // Load chat widget after page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget);
  } else {
    loadWidget();
  }
  
  function loadWidget() {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://anycommand-chatbot-production.up.railway.app/widget.html';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;';
    iframe.allow = 'clipboard-write';
    iframe.setAttribute('title', 'Chat Widget');
    iframe.setAttribute('loading', 'lazy');
    document.body.appendChild(iframe);
  }
})();
</script>
```

### Step 10: Upload to Hostinger

1. **Via File Manager**:
   - Login to Hostinger control panel
   - Go to File Manager
   - Navigate to `public_html` (or your site's root)
   - Edit your main HTML file (usually `index.html`)
   - Add the widget code before `</body>`
   - Save

2. **Via FTP**:
   - Use FileZilla or similar
   - Download your HTML file
   - Add the widget code
   - Upload back to server

3. **If using WordPress/CMS**:
   - Go to Appearance → Theme Editor
   - Edit `footer.php`
   - Add the widget code before `</body>` or `<?php wp_footer(); ?>`
   - Save

---

## Part 4: Testing & Verification

### Step 11: Test Everything

1. **Test the API directly**:
```bash
curl -X POST https://anycommand-chatbot-production.up.railway.app/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is AnyCommand?"}'
```

2. **Test the widget standalone**:
```
https://anycommand-chatbot-production.up.railway.app/widget.html
```

3. **Test on your Hostinger site**:
   - Visit your website
   - Look for the chat button in bottom-right
   - Click and ask a question
   - Verify response comes back

### Step 12: Monitor & Debug

**Check Railway Logs**:
- Go to Railway dashboard
- Click your project
- Go to "Deployments" → Click latest deployment → "View Logs"

**Common Issues**:

1. **CORS Error**: Make sure `ALLOWED_ORIGINS` includes your domain
2. **API Key Error**: Verify your OpenAI API key in Railway variables
3. **Embeddings Missing**: Upload `data/embeddings.json` or run scrape/ingest
4. **Widget Not Showing**: Check browser console for errors

---

## Part 5: Cost & Optimization

### Railway Pricing

- **Starter Plan**: $5/month (includes $5 credit)
- **Usage**: ~$0.20/GB data transfer
- Your chatbot should cost < $5/month for moderate traffic

### Optimization Tips

1. **Add Caching** (reduce API calls):
```typescript
// In server.ts, cache responses
const cache = new Map();
app.post('/chat', async (req, res) => {
  const cacheKey = req.body.message.toLowerCase();
  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }
  // ... rest of code
  cache.set(cacheKey, response);
});
```

2. **Add Rate Limiting**:
```bash
npm i express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/chat', limiter);
```

3. **Compress Responses**:
```bash
npm i compression
```

```typescript
import compression from 'compression';
app.use(compression());
```

---

## Part 6: Updating the Chatbot

### To Update Content (Re-scrape):

1. SSH into Railway or run locally:
```bash
npm run scrape
npm run ingest
```

2. Upload new `embeddings.json`:
```bash
git add data/embeddings.json
git commit -m "Update embeddings"
git push
```

### To Update Widget Design:

1. Edit `public/widget.html` locally
2. Commit and push:
```bash
git add public/widget.html
git commit -m "Update widget design"
git push
```

Railway auto-deploys!

---

## Quick Reference Card

### Your URLs:
- **API**: `https://your-app.up.railway.app/chat`
- **Widget**: `https://your-app.up.railway.app/widget.html`
- **Demo**: `https://your-app.up.railway.app/demo.html`
- **Your Site**: `https://yourdomain.com`

### Quick Commands:
```bash
# Push updates
git add .
git commit -m "Update message"
git push

# Check Railway logs
railway logs

# Re-scrape content
npm run scrape && npm run ingest
```

---

## Need Help?

**Railway Issues**: https://railway.app/help
**OpenAI Issues**: Check API dashboard at https://platform.openai.com/
**Widget Issues**: Check browser console (F12)

---

## Security Checklist

- [ ] API key is in Railway environment variables (not in code)
- [ ] CORS is restricted to your domain only
- [ ] Rate limiting is enabled
- [ ] HTTPS is enabled (automatic on Railway)
- [ ] `.env` file is in `.gitignore`
- [ ] OpenAI API key has usage limits set

---

You're all set! 🚀

