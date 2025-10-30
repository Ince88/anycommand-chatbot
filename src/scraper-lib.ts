import { URL } from 'url';

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ChatBotTestBot/1.0 (+dynamic testing)' }
  });
  if (!res.ok) throw new Error(`Fetch ${url} -> ${res.status}`);
  return await res.text();
}

export function extractLinks(html: string, base: string, sameHostOnly = true): string[] {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const abs = links
    .map(href => {
      try {
        return new URL(href, base);
      } catch {
        return null;
      }
    })
    .filter((u): u is URL => u !== null && ['http:', 'https:'].includes(u.protocol));
  
  const baseHost = new URL(base).host;
  return abs
    .filter(u => !sameHostOnly || u.host === baseHost)
    .map(u => u.toString().replace(/#.*$/, ''))
    .filter(u => !u.match(/\.(pdf|png|jpe?g|gif|svg|zip|mp4|mp3|webp|ico|css|js|woff|woff2|ttf|eot)$/i));
}

export async function scrapeUrl(startUrl: string, maxPages = 10): Promise<{ url: string; html: string }[]> {
  const queue = [startUrl];
  const seen = new Set<string>();
  const results: { url: string; html: string }[] = [];

  while (queue.length && seen.size < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    
    try {
      const html = await fetchHtml(url);
      results.push({ url, html });
      
      // Only scrape links from the first page for demo purposes (faster)
      if (results.length === 1) {
        const next = extractLinks(html, url);
        for (const n of next.slice(0, 5)) { // Limit to 5 subpages
          if (!seen.has(n)) queue.push(n);
        }
      }
    } catch (e: any) {
      console.warn(`Skip ${url}: ${e.message}`);
    }
  }
  
  return results;
}

