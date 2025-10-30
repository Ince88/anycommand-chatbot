# 🚀 Quick Deployment Checklist

Follow these steps in order. Check off each item as you complete it.

## Pre-Deployment (10 minutes)

- [ ] 1. Create GitHub repository at https://github.com/new
      - Name it: `anycommand-chatbot`
      - Make it private or public (your choice)
      - Don't initialize with README

- [ ] 2. Push your code to GitHub:
```bash
cd "C:\Users\incec\PycharmProjects\chatbot test\mile-chat-test"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/anycommand-chatbot.git
git branch -M main
git push -u origin main
```

## Railway Deployment (5 minutes)

- [ ] 3. Go to https://railway.app/ and login

- [ ] 4. Click "New Project" → "Deploy from GitHub repo"

- [ ] 5. Select your `anycommand-chatbot` repository

- [ ] 6. Wait for deployment (2-3 minutes)

- [ ] 7. Add Environment Variables (click "Variables" tab):
```
AI_API_KEY = your-openai-api-key-here
AI_BASE_URL = https://api.openai.com
AI_MODEL = gpt-4o-mini
EMBED_MODEL = text-embedding-3-small
SITE_URL = https://anycommand.io/
PORT = 3000
ALLOWED_ORIGINS = https://yourdomain.com
```

**IMPORTANT**: Replace `ALLOWED_ORIGINS` with YOUR Hostinger domain!

- [ ] 8. Copy your Railway URL (looks like: `https://yourapp.up.railway.app`)

## Update Widget for Production (2 minutes)

- [ ] 9. Open `public/widget.html` in your editor

- [ ] 10. Find this line (around line 382):
```javascript
apiUrl: 'http://localhost:3000/chat',
```

- [ ] 11. Change it to your Railway URL:
```javascript
apiUrl: 'https://yourapp.up.railway.app/chat',
```

- [ ] 12. Save and push to GitHub:
```bash
git add public/widget.html
git commit -m "Update API URL for production"
git push
```

Railway will auto-redeploy (wait 1-2 minutes).

## Test Your Deployment (2 minutes)

- [ ] 13. Test the widget directly:
```
https://yourapp.up.railway.app/widget.html
```

- [ ] 14. Try asking a question - it should work!

## Add to Your Hostinger Website (5 minutes)

- [ ] 15. Login to Hostinger control panel

- [ ] 16. Go to File Manager → `public_html`

- [ ] 17. Edit your `index.html` (or main HTML file)

- [ ] 18. Add this code BEFORE the closing `</body>` tag:
```html
<!-- AnyCommand Chat Widget -->
<iframe 
  src="https://yourapp.up.railway.app/widget.html" 
  style="position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;"
  allow="clipboard-write"
  title="Chat Widget"
></iframe>
```

**IMPORTANT**: Replace `yourapp.up.railway.app` with YOUR actual Railway URL!

- [ ] 19. Save the file

- [ ] 20. Visit your website and test the chat widget!

## ✅ You're Done!

Your chatbot is now live on your website! 🎉

### Quick Links

- **Your API**: `https://yourapp.up.railway.app/chat`
- **Widget URL**: `https://yourapp.up.railway.app/widget.html`
- **Railway Dashboard**: https://railway.app/dashboard
- **Your Website**: `https://yourdomain.com`

### Need to Update?

**Update content (re-scrape)**:
```bash
# On Railway dashboard → Click your project → Shell
npm run scrape
npm run ingest
```

**Update widget design**:
1. Edit `public/widget.html`
2. Push to GitHub
3. Railway auto-deploys!

---

## Troubleshooting

### Widget not showing?
- Check browser console (F12) for errors
- Verify the iframe src URL is correct
- Check CORS settings in Railway variables

### CORS Error?
- Add your domain to `ALLOWED_ORIGINS` in Railway
- Format: `https://yourdomain.com,https://www.yourdomain.com`

### API Not responding?
- Check Railway logs (Dashboard → Deployments → View Logs)
- Verify environment variables are set
- Test API directly with curl

### No answers / Empty responses?
- Make sure `data/embeddings.json` exists
- Run `npm run scrape` then `npm run ingest` on Railway

---

## 💰 Cost Estimate

**Railway**: ~$5/month (includes $5 credit)
**OpenAI API**: ~$0.01 per conversation (varies by usage)

**Total**: Should be under $10/month for moderate traffic!

---

## 🎯 Next Steps (Optional)

- [ ] Add rate limiting (see EMBED.md)
- [ ] Set up monitoring/alerts on Railway
- [ ] Add analytics tracking
- [ ] Customize widget colors to match your brand
- [ ] Add more content by updating SITE_URL and re-scraping

---

**Questions?** Read the full guide: `DEPLOYMENT.md`

