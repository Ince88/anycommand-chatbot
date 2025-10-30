# AnyCommand Chatbot

A TypeScript Node.js RAG (Retrieval-Augmented Generation) chat system with a production-ready widget for any website.

> 🚀 **Ready to Deploy?** See `DEPLOY-CHECKLIST.md` for quick deployment to Railway + Hostinger!

## Features

- **Web Scraper**: Breadth-first crawler that respects same-host constraints
- **Content Ingestion**: Extracts readable content using Mozilla Readability and chunks text for embedding
- **RAG Chat Server**: Retrieves relevant chunks via cosine similarity and generates contextual answers with inline citations
- **Language Detection**: Automatically responds in Hungarian or English based on user input
- **Minimal UI**: Clean chat interface for testing

## Project Structure

```
mile-chat-test/
├── src/
│   ├── scrape.ts      # Web crawler
│   ├── ingest.ts      # Content parser & embedder
│   └── server.ts      # RAG chat API + static server
├── public/
│   └── index.html     # Chat UI
├── data/
│   ├── raw/           # Scraped HTML files
│   └── embeddings.json # Processed chunks + vectors
├── .env               # Configuration
├── package.json
└── tsconfig.json
```

## Setup & Configuration

### 1. Configure Environment

Edit `.env` and add your OpenAI-compatible API credentials:

```env
AI_API_KEY=your-actual-api-key
AI_BASE_URL=https://api.your-provider.com
AI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small
SITE_URL=https://www.mile-kft.hu/
PORT=3000
```

**Note**: The project is pre-configured but requires valid `AI_API_KEY` and `AI_BASE_URL` before running.

## Runbook

Follow these steps in order to scrape, ingest, and run the chat server:

### Step 1: Scrape the Website

```bash
npm run scrape
```

This will:
- Crawl up to 120 pages from `SITE_URL`
- Save HTML files to `data/raw/`
- Respect same-host constraints and skip binary files

### Step 2: Ingest & Embed Content

```bash
npm run ingest
```

This will:
- Parse scraped HTML using Mozilla Readability
- Chunk text into ~3000 character segments
- Generate embeddings for all chunks
- Save to `data/embeddings.json`

### Step 3: Start the Chat Server

```bash
npm run dev
```

Then visit: **http://localhost:3000**

The server provides:
- `POST /chat` - RAG endpoint with inline citations
- Static file serving for the UI

## Usage

1. Open http://localhost:3000 in your browser
2. Type questions in Hungarian or English
3. Receive contextual answers with source citations (e.g., [S1], [S2])

**Example questions:**
- "Milyen szolgáltatásokat kínáltok?" (Hungarian)
- "What services does the company offer?" (English)

## API

### POST /chat

**Request:**
```json
{
  "message": "Your question here",
  "metadata": {
    "userId": "optional-user-id"
  }
}
```

**Response:**
```json
{
  "reply": "Answer with inline citations [S1] [S2]...",
  "sources": [
    {
      "id": "S1",
      "title": "Page Title",
      "url": "https://www.mile-kft.hu/page",
      "score": 0.856
    }
  ]
}
```

## Scripts

- `npm run dev` - Start server in watch mode (auto-restart on changes)
- `npm run scrape` - Run web scraper
- `npm run ingest` - Process HTML and generate embeddings

## Website Integration

### Quick Start

Three files are ready for integration:

1. **`/widget.html`** - Standalone chat widget (ready to embed)
2. **`/demo.html`** - Example integration on a website
3. **`EMBED.md`** - Complete integration guide

### Test It Locally

```bash
# Visit the standalone widget
http://localhost:3000/widget.html

# Visit the demo integration
http://localhost:3000/demo.html
```

### Embed in Your Site

Add this snippet before `</body>`:

```html
<!-- Simple iframe embed -->
<iframe 
  src="https://your-domain.com/widget.html" 
  style="position:fixed;bottom:0;right:0;width:420px;height:650px;border:none;z-index:999;background:transparent;"
  allow="clipboard-write"
  title="Chat Widget"
></iframe>

<!-- OR use JavaScript -->
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

See `EMBED.md` for complete integration options and customization.

## Nice-to-Haves (Future Enhancements)

The following features are planned but **not yet implemented**:

1. **Streaming Answers**: Server-Sent Events (SSE) endpoint at `/chat/stream` for real-time streaming responses

2. **Persistent Storage**: Replace JSON file with SQLite + pgvector for scalable vector storage

3. **Content Filtering**: Strip navigation/footer elements before Readability parsing

4. **Rate Limiting**: Add Express middleware to prevent API abuse ✅ **DONE - See EMBED.md**

5. **CORS Middleware**: Enable cross-origin requests ✅ **DONE**

6. **Language Toggle**: UI button to force Hungarian/English responses regardless of auto-detection

## Technical Details

- **Embedding Model**: text-embedding-3-small (configurable)
- **Chat Model**: gpt-4o-mini (configurable)
- **Retrieval**: Top-5 chunks via cosine similarity
- **Chunking**: ~3000 characters per chunk, split on paragraphs
- **Language Detection**: Regex-based Hungarian character/keyword detection

## Development Notes

- All API endpoints use OpenAI-compatible format (`/v1/embeddings`, `/v1/chat/completions`)
- Scraper uses polite User-Agent and respects robots.txt (for testing only)
- Temperature set to 0.2 for more deterministic responses
- Maximum 120 pages scraped by default (adjust `MAX_PAGES` in `scrape.ts`)

## License

ISC

