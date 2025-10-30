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
    .filter(u => !u.match(/\.(pdf|png|jpe?g|gif|svg|zip|mp4|mp3|webp|ico|css|js|woff|woff2|ttf|eot)(\?|$)/i));
}

export async function scrapeUrl(startUrl: string, maxPages = 20): Promise<{ url: string; html: string }[]> {
  const queue = [startUrl];
  const seen = new Set<string>();
  const results: { url: string; html: string }[] = [];

  while (queue.length && seen.size < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    
    // Skip non-HTML files
    if (url.match(/\.(pdf|png|jpe?g|gif|svg|zip|mp4|mp3|webp|ico|css|js|woff|woff2|ttf|eot)(\?|$)/i)) {
      console.log(`[Scraper] Skipping non-HTML: ${url}`);
      continue;
    }
    
    try {
      const html = await fetchHtml(url);
      
      // Verify it's actually HTML content
      if (!html.trim().toLowerCase().startsWith('<!doctype') && !html.trim().toLowerCase().startsWith('<html')) {
        console.log(`[Scraper] Skipping non-HTML content: ${url}`);
        continue;
      }
      
      results.push({ url, html });
      console.log(`[Scraper] Added page ${results.length}: ${url}`);

      // Always enqueue links (breadth-first), but throttle per page
      const next = extractLinks(html, url);
      console.log(`[Scraper] Found ${next.length} links`);
      for (const n of next.slice(0, 20)) { // throttle fan-out per page
        if (seen.size + queue.length >= maxPages) break;
        if (!seen.has(n)) queue.push(n);
      }
    } catch (e: any) {
      console.warn(`[Scraper] Skip ${url}: ${e.message}`);
    }
  }
  
  console.log(`[Scraper] Completed: ${results.length} pages scraped`);
  return results;
}

