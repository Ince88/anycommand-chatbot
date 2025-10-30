import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import crypto from 'crypto';
import { scrapeUrl } from './scraper-lib.js';
import { parseAndEmbed, type Doc } from './ingest-lib.js';

const app = express();

// Session storage for multi-user demos
const sessions = new Map<string, { docs: Doc[]; createdAt: number; status: 'scraping' | 'ready' }>();

// Cleanup old sessions every 10 minutes (older than 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > 30 * 60 * 1000) {
      sessions.delete(sessionId);
      console.log(`Cleaned up session: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

// Enable CORS for all origins (restrict in production)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',');
app.use(cors({
  origin: allowedOrigins || true, // true = reflect request origin
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

const ChatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  metadata: z.object({ userId: z.string().optional() }).optional()
});

const ScrapeSchema = z.object({
  url: z.string().url()
});

const EMB_PATH = path.join(process.cwd(), 'data', 'embeddings.json');
const DOCS: Doc[] = fs.existsSync(EMB_PATH) ? JSON.parse(fs.readFileSync(EMB_PATH, 'utf8')) : [];

function dot(a: number[], b: number[]) { let s = 0; for (let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }
function norm(a: number[]) { return Math.sqrt(dot(a,a)); }
function cos(a: number[], b: number[]) { return dot(a,b) / (norm(a)*norm(b) + 1e-12); }

async function embed(text: string): Promise<number[]> {
  const baseUrl = process.env.AI_BASE_URL!;
  const key = process.env.AI_API_KEY!;
  const model = process.env.EMBED_MODEL || 'text-embedding-3-small';
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text })
  });
  if (!res.ok) throw new Error(`Embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function chat(messages: {role:'system'|'user'|'assistant'; content:string}[]) {
  const baseUrl = process.env.AI_BASE_URL!;
  const key = process.env.AI_API_KEY!;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  if (!res.ok) throw new Error(`Model error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function looksHungarian(s: string) {
  return /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(s) || /\b(és|van|vagy|kérlek|ár|nyitvatartás)\b/i.test(s);
}

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = ChatSchema.parse(req.body);

    // Use session-specific docs or default DOCS
    let docsToUse: Doc[] = DOCS;
    if (sessionId) {
      console.log(`[Chat] Request with sessionId: ${sessionId}`);
      if (sessions.has(sessionId)) {
        docsToUse = sessions.get(sessionId)!.docs;
        console.log(`[Chat] Using session docs: ${docsToUse.length} documents, ${docsToUse.reduce((sum, d) => sum + d.chunks.length, 0)} chunks`);
      } else {
        console.log(`[Chat] Session ${sessionId} not found! Using default docs.`);
      }
    } else {
      console.log(`[Chat] No sessionId provided, using default docs`);
    }

    if (docsToUse.length === 0) {
      return res.json({ 
        reply: 'Nincs elérhető tartalom. Kérlek, adj meg egy weboldal URL-t a teszteléshez!', 
        sources: [] 
      });
    }

    // retrieve
    const qVec = await embed(message);
    type Hit = { score:number; chunk:string; url:string; title:string };
    const hits: Hit[] = [];
    for (const d of docsToUse) {
      d.vectors.forEach((v, idx) => {
        hits.push({ score: cos(qVec, v), chunk: d.chunks[idx], url: d.url, title: d.title });
      });
    }
    hits.sort((a,b)=>b.score-a.score);
    const top = hits.slice(0, 5);

    const context = top.map((h, i) => `Source ${i+1} (${h.title}):\n${h.chunk}`).join('\n\n');
    const sources = top.map((h,i)=>`[S${i+1}] ${h.title} — ${h.url}`).join('\n');

    const hu = looksHungarian(message);
    const system = {
      role: 'system' as const,
      content: [
        'You are a concise support bot that answers ONLY using the provided context.',
        'If the answer is not in context, say you do not know and suggest contacting the company.',
        'Cite sources inline as [S1], [S2] etc. matching the provided Source list.',
        hu ? 'Respond in Hungarian.' : 'Respond in the user language (default English).'
      ].join(' ')
    };

    const reply = await chat([
      system,
      { role:'user', content:
`User question:
${message}

Context:
${context}

When you answer, include inline citations like [S1], [S2].

Sources:
${sources}`
      }
    ]);

    res.json({ reply, sources: top.map((h,i)=>({ id: `S${i+1}`, title: h.title, url: h.url, score: +h.score.toFixed(3) })) });
  } catch (e:any) {
    res.status(400).json({ error: e.message });
  }
});

// Custom scraping endpoint for multi-user demo (async)
app.post('/custom-scrape', async (req, res) => {
  try {
    const { url } = ScrapeSchema.parse(req.body);
    
    console.log(`[Custom Scrape] Starting for: ${url}`);
    
    // Create session immediately
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { docs: [], createdAt: Date.now(), status: 'scraping' });
    
    // Return immediately
    res.json({ 
      sessionId,
      status: 'scraping',
      message: 'Feldolgozás megkezdve...'
    });
    
    // Scrape in background
    (async () => {
      try {
        console.log(`[Session ${sessionId}] Scraping ${url}...`);
        const pages = await scrapeUrl(url, 6);
        
        if (pages.length === 0) {
          sessions.delete(sessionId);
          console.log(`[Session ${sessionId}] No pages scraped, session deleted`);
          return;
        }
        
        console.log(`[Session ${sessionId}] Scraped ${pages.length} pages, embedding...`);
        
        const docs = await parseAndEmbed(
          pages,
          process.env.AI_BASE_URL!,
          process.env.AI_API_KEY!,
          process.env.EMBED_MODEL || 'text-embedding-3-small'
        );
        
        if (docs.length === 0) {
          sessions.delete(sessionId);
          console.log(`[Session ${sessionId}] No docs extracted, session deleted`);
          return;
        }
        
        // Update session with results
        sessions.set(sessionId, { docs, createdAt: Date.now(), status: 'ready' });
        console.log(`[Session ${sessionId}] Ready! ${docs.length} documents, ${docs.reduce((sum, d) => sum + d.chunks.length, 0)} chunks`);
        
      } catch (e: any) {
        console.error(`[Session ${sessionId}] Error:`, e);
        sessions.delete(sessionId);
      }
    })();
    
  } catch (e: any) {
    console.error('[Custom Scrape] Error:', e);
    res.status(500).json({ error: e.message || 'Hiba történt a feldolgozás során.' });
  }
});

// Check session status
app.get('/session-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.json({ status: 'not_found' });
  }
  
  if (session.status === 'scraping') {
    return res.json({ status: 'scraping' });
  }
  
  // Ready
  res.json({ 
    status: 'ready',
    message: `Sikeresen betöltve: ${session.docs.length} oldal, ${session.docs.reduce((sum, d) => sum + d.chunks.length, 0)} szövegrész.`,
    pages: session.docs.map(d => ({ title: d.title, url: d.url }))
  });
});

// static site for the chat UI
app.use(express.static(path.join(process.cwd(), 'public')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Server running: http://localhost:${port}`));

