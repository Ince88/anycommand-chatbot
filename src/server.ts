import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

type Doc = { id: string; url: string; title: string; chunks: string[]; vectors: number[][] };

const app = express();

// Enable CORS for all origins (restrict in production)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

const ChatSchema = z.object({
  message: z.string().min(1),
  metadata: z.object({ userId: z.string().optional() }).optional()
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
    const { message } = ChatSchema.parse(req.body);

    // retrieve
    const qVec = await embed(message);
    type Hit = { score:number; chunk:string; url:string; title:string };
    const hits: Hit[] = [];
    for (const d of DOCS) {
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

// static site for the chat UI
app.use(express.static(path.join(process.cwd(), 'public')));

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Server running: http://localhost:${port}`));

