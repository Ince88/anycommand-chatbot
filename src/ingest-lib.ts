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

function extractContactInfo(document: any): string {
  const contactInfo: string[] = [];
  
  // Extract email links
  const emailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
  emailLinks.forEach((link: any) => {
    const email = link.href.replace('mailto:', '');
    const text = link.textContent?.trim();
    contactInfo.push(`Email: ${email}${text && text !== email ? ` (${text})` : ''}`);
  });
  
  // Extract phone links
  const phoneLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
  phoneLinks.forEach((link: any) => {
    const phone = link.href.replace('tel:', '');
    const text = link.textContent?.trim();
    contactInfo.push(`Phone: ${phone}${text && text !== phone ? ` (${text})` : ''}`);
  });
  
  // Extract button text (often contains contact CTAs)
  const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"]'));
  buttons.forEach((btn: any) => {
    const text = btn.textContent?.trim();
    if (text && text.length < 100 && (
      text.toLowerCase().includes('contact') ||
      text.toLowerCase().includes('call') ||
      text.toLowerCase().includes('email') ||
      text.toLowerCase().includes('kapcsolat') ||
      text.toLowerCase().includes('hívj')
    )) {
      contactInfo.push(`Button: ${text}`);
    }
  });
  
  // Extract footer content (often has contact info)
  const footers = Array.from(document.querySelectorAll('footer, [role="contentinfo"]'));
  footers.forEach((footer: any) => {
    const text = footer.textContent?.trim();
    if (text && text.length < 500) {
      contactInfo.push(`Footer info: ${text}`);
    }
  });
  
  return contactInfo.length > 0 ? '\n\nContact Information:\n' + contactInfo.join('\n') : '';
}

function extractPricingInfo(document: any): string {
  const pricingLines: string[] = [];

  // Common price markers (Hungarian + general)
  const priceRegex = /(\d{1,3}(?:[ .]\d{3})*(?:[,.]\d+)?)[\s\u00A0]*(Ft|HUF|euró|EUR|usd|USD)/i;
  const perPeriodRegex = /(\/hó|\/honap|\/hónap|per\s+month|\/mo)/i;

  // Heuristic: scan text of typical pricing sections
  const selectors = [
    '[class*="price" i]',
    '[class*="ar" i]',
    '[class*="csomag" i]',
    '[id*="price" i]',
    '[id*="ar" i]'
  ];

  const nodes = Array.from(document.querySelectorAll(selectors.join(',')));
  nodes.forEach((el: any) => {
    const text = el.textContent?.replace(/[\t\r]+/g, ' ').replace(/[ ]{2,}/g, ' ').trim();
    if (!text) return;
    // Break into lines and keep those that look like price lines
    text.split(/\n+/).forEach((line: string) => {
      const l = line.trim();
      if (!l) return;
      if (priceRegex.test(l) || perPeriodRegex.test(l)) {
        // Shorten very long lines
        const clipped = l.length > 180 ? l.slice(0, 177) + '…' : l;
        pricingLines.push(clipped);
      }
    });
  });

  // Also scan all links/buttons that may include prices
  const ctas = Array.from(document.querySelectorAll('a, button'));
  ctas.forEach((el: any) => {
    const t = el.textContent?.trim();
    if (t && (priceRegex.test(t) || perPeriodRegex.test(t))) {
      pricingLines.push(t);
    }
  });

  // De-duplicate while preserving order
  const seen = new Set<string>();
  const unique = pricingLines.filter(l => (seen.has(l) ? false : (seen.add(l), true)));

  return unique.length > 0 ? '\n\nPricing Information:\n' + unique.join('\n') : '';
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
    const document = dom.window.document;
    const reader = new Readability(document);
    const art = reader.parse();
    
    if (!art || !art.textContent?.trim()) continue;

    // Get main content
    let clean = art.textContent.replace(/\s+\n/g, '\n').trim();
    
    // Add extracted contact & pricing info
    clean += extractContactInfo(document);
    clean += extractPricingInfo(document);
    
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

