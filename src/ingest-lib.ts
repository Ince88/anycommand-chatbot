import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export type Doc = { 
  id: string; 
  url: string; 
  title: string; 
  text: string; 
  chunks: string[]; 
  vectors: number[][] 
};

export function chunkText(txt: string, maxChars = 1500): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const para of txt.split(/\n{2,}/)) {
    if (para.length > maxChars) {
      if (cur.trim()) {
        parts.push(cur.trim());
        cur = '';
      }
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

export async function embed(text: string, baseUrl: string, apiKey: string, model: string): Promise<number[]> {
  const res = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: [text] })
  });
  if (!res.ok) throw new Error(`Embed error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

export async function parseAndEmbed(
  pages: { url: string; html: string }[],
  baseUrl: string,
  apiKey: string,
  embedModel: string
): Promise<Doc[]> {
  const docs: Doc[] = [];

  for (const page of pages) {
    const dom = new JSDOM(page.html, { url: page.url });
    const reader = new Readability(dom.window.document);
    const art = reader.parse();
    
    if (!art || !art.textContent?.trim()) continue;

    const clean = art.textContent.replace(/\s+\n/g, '\n').trim();
    const chunks = chunkText(clean, 1500);
    
    docs.push({ 
      id: page.url, 
      url: page.url, 
      title: art.title || page.url, 
      text: clean, 
      chunks,
      vectors: []
    });
  }

  // Embed all chunks
  const allChunks = docs.flatMap(d => d.chunks);
  const allVecs: number[][] = [];
  
  for (let i = 0; i < allChunks.length; i++) {
    console.log(`[Session] Embedding chunk ${i + 1}/${allChunks.length}`);
    const vec = await embed(allChunks[i]!, baseUrl, apiKey, embedModel);
    allVecs.push(vec);
  }

  // Assign vectors back to docs
  let i = 0;
  for (const d of docs) {
    d.vectors = d.chunks.map(() => allVecs[i++]);
  }

  return docs;
}

