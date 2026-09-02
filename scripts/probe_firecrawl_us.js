import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'benchmarks');

const CASES = [
  {
    label: 'canvas-tote',
    query: 'site:temu.com canvas tote bag black handles printed reusable',
    required: [/canvas/i, /(tote|bag)/i],
  },
  {
    label: 'golf-towel',
    query: 'site:temu.com golf towel clip carabiner printed',
    required: [/golf/i, /towel/i],
  },
  {
    label: 'beach-bag',
    query: 'site:temu.com polyester beach tote bag women printed',
    required: [/(beach|pool)/i, /(tote|bag)/i],
  },
  {
    label: 'mouse-pad',
    query: 'site:temu.com 3mm rubber square mouse pad printed non slip',
    required: [/(mouse pad|mousepad|mouse mat)/i, /rubber/i],
  },
];

function directProduct(url) {
  try {
    const parsed = new URL(url);
    const first = parsed.pathname.split('/').filter(Boolean)[0] || '';
    const localePrefix = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(first) ? first : null;
    return /(^|\.)temu\.com$/i.test(parsed.hostname)
      && /-g-\d+\.html$/i.test(parsed.pathname)
      && !localePrefix;
  } catch {
    return false;
  }
}

function sameProduct(text, required) {
  return required.every((regex) => regex.test(text));
}

async function firecrawlSearch(testCase) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.FIRECRAWL_API_KEY) headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;

  const response = await fetch('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: testCase.query,
      limit: 5,
      sources: ['web'],
      includeDomains: ['temu.com'],
      location: 'United States',
      country: 'US',
      timeout: 60000,
      scrapeOptions: {
        formats: ['markdown', 'links'],
        parsers: [],
      },
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(`Firecrawl ${response.status}: ${payload.error || text.slice(0, 300)}`);
  }

  const web = payload.data?.web || [];
  const normalized = web.map((item) => {
    const content = `${item.title || ''} ${item.description || ''} ${item.markdown || ''}`;
    const links = Array.isArray(item.links) ? item.links : [];
    const productLinks = links.filter(directProduct);
    return {
      title: item.title || '',
      url: item.url || '',
      description: item.description || '',
      markdownChars: (item.markdown || '').length,
      linkCount: links.length,
      directUsProductLinks: productLinks,
      directUsProductLinkCount: productLinks.length,
      resultSameProduct: sameProduct(content, testCase.required),
      metadataStatusCode: item.metadata?.statusCode ?? null,
      metadataError: item.metadata?.error ?? null,
    };
  });

  const discovered = [...new Set(normalized.flatMap((item) => item.directUsProductLinks))];
  return {
    label: testCase.label,
    query: testCase.query,
    creditsUsed: payload.creditsUsed ?? null,
    resultCount: normalized.length,
    scrapedResultCount: normalized.filter((item) => item.markdownChars > 0 || item.linkCount > 0).length,
    sameProductResultCount: normalized.filter((item) => item.resultSameProduct).length,
    discoveredDirectUsProductLinks: discovered,
    discoveredDirectUsProductLinkCount: discovered.length,
    results: normalized,
  };
}

async function main() {
  const runs = [];
  for (const testCase of CASES) {
    const started = Date.now();
    try {
      const result = await firecrawlSearch(testCase);
      runs.push({ ...result, durationMs: Date.now() - started });
      console.log(`${testCase.label}: results=${result.resultCount}, scraped=${result.scrapedResultCount}, US direct links=${result.discoveredDirectUsProductLinkCount}, credits=${result.creditsUsed}`);
    } catch (error) {
      runs.push({ label: testCase.label, query: testCase.query, durationMs: Date.now() - started, error: error.message });
      console.warn(`${testCase.label}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Test whether US-targeted Firecrawl Search + scrapeOptions can turn Temu search pages into direct US product links.',
    totalCreditsReported: runs.reduce((sum, run) => sum + (Number(run.creditsUsed) || 0), 0),
    totalDiscoveredDirectUsProductLinks: runs.reduce((sum, run) => sum + (run.discoveredDirectUsProductLinkCount || 0), 0),
    runs,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const output = path.join(OUTPUT_DIR, 'firecrawl-us-probe.json');
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Saved ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
