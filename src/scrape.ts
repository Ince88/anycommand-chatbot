import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const START = process.env.SITE_URL!;
const OUT_DIR = path.join(process.cwd(), 'data', 'raw');
const MAX_PAGES = 120; // adjust if needed
const SAME_HOST_ONLY = true;

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'CursorTestBot/1.0 (+local testing; respects robots.txt)' }
  });
  if (!res.ok) throw new Error(`Fetch ${url} -> ${res.status}`);
  return await res.text();
}

function extractLinks(html: string, base: string): string[] {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const abs = links
    .map(href => new URL(href, base))
    .filter(u => ['http:', 'https:'].includes(u.protocol));
  const baseHost = new URL(base).host;
  return abs
    .filter(u => !SAME_HOST_ONLY || u.host === baseHost)
    .map(u => u.toString().replace(/#.*$/, ''))
    .filter(u => !u.match(/\.(pdf|png|jpe?g|gif|svg|zip|mp4|mp3|webp|ico)$/i));
}

function saveHtml(url: string, html: string) {
  const u = new URL(url);
  let file = u.pathname;
  if (file.endsWith('/')) file += 'index.html';
  if (!path.extname(file)) file += '.html';
  const full = path.join(OUT_DIR, u.host, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

(async () => {
  if (!START) throw new Error('SITE_URL missing in .env');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const queue = [START];
  const seen = new Set<string>();
  while (queue.length && seen.size < MAX_PAGES) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const html = await fetchHtml(url);
      saveHtml(url, html);
      const next = extractLinks(html, url);
      for (const n of next) if (!seen.has(n)) queue.push(n);
      console.log(`Saved: ${url}`);
    } catch (e: any) {
      console.warn(`Skip ${url}: ${e.message}`);
    }
  }
  console.log(`Done. Pages saved: ${seen.size}`);
})();

