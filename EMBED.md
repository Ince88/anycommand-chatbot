# How to Embed the Chat Widget

## Method 1: Direct Embed (Easiest)

Add this single line to your HTML, right before the closing `</body>` tag:

```html
<script src="https://your-domain.com/widget.html" async></script>
```

## Method 2: iframe Embed (Recommended)

For complete isolation, use an iframe:

```html
<iframe 
  src="https://your-domain.com/widget.html" 
  style="position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;"
  allow="clipboard-write"
  title="Chat Widget"
></iframe>
```

## Method 3: JavaScript Snippet (Recommended for Production)

Add this snippet to your site (place before `</body>`):

```html
<!-- AnyCommand Chat Widget -->
<div id="anycommand-chat-widget"></div>
<script>
(function() {
  var config = {
    apiUrl: 'https://your-api-domain.com/chat',
    botName: 'AnyCommand Assistant',
    primaryColor: '#667eea'
  };
  
  var script = document.createElement('script');
  script.src = 'https://your-cdn.com/chat-widget.js';
  script.async = true;
  script.onload = function() {
    window.ChatWidget.init(config);
  };
  document.body.appendChild(script);
})();
</script>
```

## Configuration Options

You can customize the widget by editing these values in `widget.html`:

```javascript
const CONFIG = {
  // Your API endpoint
  apiUrl: 'https://your-api.com/chat',
  
  // Customize text
  botName: 'Your Bot Name',
  botSubtitle: 'How can I help?',
  welcomeTitle: 'Hello!',
  welcomeMessage: 'Ask me anything!',
  
  // Theme colors
  primaryColor: '#667eea',
  secondaryColor: '#764ba2',
};
```

## Testing Locally

1. **Test the standalone widget:**
   - Visit: http://localhost:3000/widget.html

2. **Test on your local site:**
   - Update `apiUrl` in `widget.html` to `http://localhost:3000/chat`
   - Serve your site locally
   - The widget should work with CORS enabled

## Production Deployment

### Step 1: Deploy the Backend

Deploy to Vercel, Railway, Render, or any Node.js host:

```bash
# Set environment variables in your hosting platform
AI_API_KEY=your-openai-key
AI_BASE_URL=https://api.openai.com
AI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
SITE_URL=https://anycommand.io/
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Step 2: Update Widget Configuration

In `public/widget.html`, change:

```javascript
const CONFIG = {
  apiUrl: 'https://your-api-domain.com/chat',  // ← Update this
  // ... rest of config
};
```

### Step 3: Host the Widget

**Option A: Same Server**
- The widget is already at `/widget.html`
- Access it at: `https://your-api-domain.com/widget.html`

**Option B: CDN (Recommended)**
- Upload `widget.html` to a CDN (Cloudflare, AWS CloudFront)
- Update the `apiUrl` in the widget
- Reference from CDN in your site

### Step 4: Embed in Your Site

Add to your website's HTML:

```html
<!-- Place before </body> -->
<iframe 
  src="https://your-domain.com/widget.html" 
  style="position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;"
  allow="clipboard-write"
  title="Chat Widget"
></iframe>

<!-- OR use JavaScript for dynamic loading -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = 'https://your-domain.com/widget.html';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;';
    iframe.allow = 'clipboard-write';
    iframe.setAttribute('title', 'Chat Widget');
    document.body.appendChild(iframe);
  })();
</script>
```

## Security Best Practices

1. **Restrict CORS Origins** (in production `.env`):
   ```
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. **Rate Limiting** - Add to `server.ts`:
   ```bash
   npm i express-rate-limit
   ```
   
   ```typescript
   import rateLimit from 'express-rate-limit';
   
   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });
   
   app.use('/chat', limiter);
   ```

3. **API Key Protection** - Never expose your API keys in client-side code

4. **Content Security Policy** - Add appropriate CSP headers

## Customization Examples

### Change Colors

In `widget.html` CSS section, update:

```css
#chat-toggle {
  background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
}
```

### Change Icon

Replace the SVG in the toggle button:

```html
<button id="chat-toggle">
  <img src="your-icon.svg" alt="Chat" />
</button>
```

### Add Analytics

In `widget.html`, add to the `sendMessage` function:

```javascript
// Track chat interaction
if (window.gtag) {
  gtag('event', 'chat_message_sent', {
    'event_category': 'Chat',
    'event_label': message
  });
}
```

## Troubleshooting

### CORS Errors
- Make sure CORS is enabled on your server
- Check that `ALLOWED_ORIGINS` includes your domain

### Widget Not Appearing
- Check browser console for errors
- Verify the `apiUrl` is correct
- Test the API endpoint directly: `curl -X POST http://your-api.com/chat -H "Content-Type: application/json" -d '{"message":"test"}'`

### Styling Conflicts
- The widget uses `position: fixed` and high z-index (999)
- If conflicts occur, adjust the z-index in `widget.html`

## Support

For issues or questions:
1. Check the browser console for errors
2. Test the API endpoint separately
3. Verify all configuration values are correct

