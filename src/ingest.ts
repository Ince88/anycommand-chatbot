import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { JSDOM } from 'jsdom';

const RAW_DIR = path.join(process.cwd(), 'data', 'raw');
const OUT_PATH = path.join(process.cwd(), 'data', 'embeddings.json');

type Doc = { id: string; url: string; title: string; text: string; chunks: string[]; vectors?: number[][] };

function chunkText(txt: string, maxChars = 1500): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const para of txt.split(/\n{2,}/)) {
    // If a single paragraph is too long, split it by sentences or characters
    if (para.length > maxChars) {
      if (cur.trim()) {
        parts.push(cur.trim());
        cur = '';
      }
      // Split long paragraph into smaller chunks
      for (let i = 0; i < para.length; i += maxChars) {
        parts.push(para.slice(i, i + maxChars).trim());
      }
      continue;
    }
    
    if ((cur + '\n\n' + para).length > maxChars) {
      if (cur.trim()) parts.push(cur.trim());
      cur = para;
    } else {
      cur = cur ? cur + '\n\n' + para : para;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

async function embed(text: string): Promise<number[]> {
  const baseUrl = process.env.AI_BASE_URL!;
  const key = process.env.AI_API_KEY!;
  const model = process.env.EMBED_MODEL || 'text-embedding-3-small';
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: [text] })
  });
  if (!res.ok) throw new Error(`Embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const baseUrl = process.env.AI_BASE_URL!;
  const key = process.env.AI_API_KEY!;
  const model = process.env.EMBED_MODEL || 'text-embedding-3-small';
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts })
  });
  if (!res.ok) throw new Error(`Embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d: any) => d.embedding);
}

(async () => {
  const files = await glob(RAW_DIR.replace(/\\/g, '/') + '/**/*.html');
  const docs: Doc[] = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');

    // Try to reconstruct a plausible URL for traceability
    const parts = file.split(path.sep);
    const hostIdx = parts.indexOf('raw') + 1;
    const host = parts[hostIdx];
    const pathParts = parts.slice(hostIdx + 1);
    const guessedPath = '/' + pathParts.join('/').replace(/index\.html$/, '');
    const guessedUrl = `https://${host}${guessedPath}`;

    const dom = new JSDOM(html, { url: guessedUrl });
    const Readability = (await import('@mozilla/readability')).Readability;
    const reader = new Readability(dom.window.document);
    const art = reader.parse();
    if (!art || !art.textContent?.trim()) continue;

    const clean = art.textContent.replace(/\s+\n/g, '\n').trim();
    const chunks = chunkText(clean, 1500);
    docs.push({ id: file, url: guessedUrl, title: art.title || guessedUrl, text: clean, chunks });
    console.log(`Parsed ${file} -> ${chunks.length} chunks`);
  }

  if (docs.length === 0) {
    console.warn('No documents parsed. Did the scraper save HTML?');
  }

  // Embed all chunks in smaller batches to avoid token limits
  const allChunks = docs.flatMap(d => d.chunks);
  if (allChunks.length === 0) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(docs, null, 2));
    console.log(`Wrote empty embeddings file: ${OUT_PATH}`);
    process.exit(0);
  }

  // Embed one at a time to avoid token limits with large chunks
  const allVecs: number[][] = [];
  for (let i = 0; i < allChunks.length; i++) {
    console.log(`Embedding chunk ${i + 1}/${allChunks.length}`);
    const vec = await embed(allChunks[i]!);
    allVecs.push(vec);
  }

  // Assign vectors back to docs
  let i = 0;
  for (const d of docs) {
    d.vectors = d.chunks.map(() => allVecs[i++]);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`Wrote ${OUT_PATH} with ${allChunks.length} chunks`);
})();

