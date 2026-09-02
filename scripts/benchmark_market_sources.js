import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT_DIR, 'public', 'data', 'catalog.json');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'benchmarks');

const DEFAULT_LIMIT = Number(process.env.BENCHMARK_RESULT_LIMIT || 10);
const DEFAULT_MARKUP_CNY = Number(process.env.DEFAULT_QUOTE_MARKUP_CNY || 4);
const PROVIDERS = (process.env.BENCHMARK_PROVIDERS || 'firecrawl')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const QUERY_RULES = [
  { label: 'pillow-cover', pattern: /(枕套|抱枕套|靠垫套)/i, query: 'double sided polyester decorative pillow cover' },
  { label: 'cosmetic-bag', pattern: /(化妆包|收纳包)/i, query: 'printed cosmetic makeup bag pouch' },
  { label: 'drawstring-bag', pattern: /(束口袋|抽绳包)/i, query: 'printed drawstring bag polyester' },
  { label: 'canvas-tote', pattern: /(帆布.*(袋|包)|手提袋)/i, query: 'printed canvas tote bag' },
  { label: 'beach-bag', pattern: /(沙滩包|海滩包)/i, query: 'printed beach tote bag' },
  { label: 'umbrella', pattern: /(雨伞|晴雨伞|自动伞)/i, query: 'automatic folding umbrella printed' },
  { label: 'mouse-pad', pattern: /(鼠标垫|桌垫)/i, query: 'printed rubber mouse pad desk mat' },
  { label: 'shower-curtain', pattern: /(浴帘|浴室帘)/i, query: 'printed shower curtain set' },
  { label: 'table-runner', pattern: /(桌旗|餐垫|桌布)/i, query: 'printed table runner polyester' },
  { label: 'beach-towel', pattern: /(沙滩巾|毛巾)/i, query: 'printed microfiber beach towel' },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function quoteFields(factoryFloorPriceCny) {
  const proposedQuoteCny = Number.isFinite(factoryFloorPriceCny)
    ? Number((factoryFloorPriceCny + DEFAULT_MARKUP_CNY).toFixed(2))
    : null;
  return {
    proposedQuoteCny,
    quoteStatus: proposedQuoteCny == null ? 'missing-factory-price' : 'provisional',
    quoteRule: `factoryFloorPriceCny + ${DEFAULT_MARKUP_CNY} CNY`,
    quoteMarkupCny: DEFAULT_MARKUP_CNY,
  };
}

function toBenchmarkProduct(product, queryLabel, query) {
  const factoryFloorPriceCny = product.price?.minCny ?? null;
  return {
    id: product.id,
    title: product.title,
    category: product.category?.name || '',
    factoryFloorPriceCny,
    ...quoteFields(factoryFloorPriceCny),
    actualSubmittedQuoteCny: null,
    temuApprovedPriceCny: null,
    queryLabel,
    query,
  };
}

function selectBenchmarkProducts(products) {
  const active = products.filter((product) => product.active !== false);
  const selected = [];
  const used = new Set();

  for (const rule of QUERY_RULES) {
    const product = active.find((item) => !used.has(item.id) && rule.pattern.test(item.title || ''));
    if (!product) continue;
    used.add(product.id);
    selected.push(toBenchmarkProduct(product, rule.label, `site:temu.com ${rule.query}`));
  }

  if (selected.length < 10) {
    for (const product of active) {
      if (selected.length >= 10) break;
      if (used.has(product.id)) continue;
      used.add(product.id);
      selected.push(toBenchmarkProduct(product, 'fallback', `site:temu.com ${product.title}`));
    }
  }

  return selected.slice(0, 10);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 300)}`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload.error || payload.message || text.slice(0, 300)}`);
  return payload;
}

async function searchFirecrawl(query, limit) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.FIRECRAWL_API_KEY) headers.Authorization = `Bearer ${process.env.FIRECRAWL_API_KEY}`;
  const payload = await requestJson('https://api.firecrawl.dev/v2/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, limit }),
  });
  const data = payload.data || payload;
  const web = Array.isArray(data.web) ? data.web : (Array.isArray(data) ? data : []);
  return {
    provider: 'firecrawl',
    usage: payload.usage || data.usage || null,
    results: web.map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || '',
      snippet: item.description || item.markdown || '',
      score: item.score ?? null,
      raw: item,
    })),
  };
}

async function searchTavily(query, limit) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');
  const payload = await requestJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: Math.min(limit, 20),
      include_domains: ['temu.com'],
      include_answer: false,
      include_raw_content: false,
      include_usage: true,
    }),
  });
  return {
    provider: 'tavily',
    usage: payload.usage || null,
    results: (payload.results || []).map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || '',
      score: item.score ?? null,
      raw: item,
    })),
  };
}

async function searchExa(query, limit) {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY not configured');
  const payload = await requestJson('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults: limit,
      includeDomains: ['temu.com'],
      contents: { text: { maxCharacters: 1200 } },
    }),
  });
  return {
    provider: 'exa',
    usage: payload.costDollars || null,
    results: (payload.results || []).map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || '',
      snippet: item.text || '',
      score: item.score ?? null,
      publishedDate: item.publishedDate || null,
      raw: item,
    })),
  };
}

const SEARCHERS = {
  firecrawl: searchFirecrawl,
  tavily: searchTavily,
  exa: searchExa,
};

function summarizeProviderRuns(runs) {
  const successful = runs.filter((run) => !run.error);
  const resultCounts = successful.map((run) => run.results.length);
  const temuCounts = successful.map((run) => run.results.filter((result) => /(^|\.)temu\.com/i.test(new URL(result.url).hostname)).length);
  return {
    queries: runs.length,
    successfulQueries: successful.length,
    failedQueries: runs.length - successful.length,
    totalResults: resultCounts.reduce((sum, value) => sum + value, 0),
    totalTemuResults: temuCounts.reduce((sum, value) => sum + value, 0),
    averageResultsPerSuccessfulQuery: successful.length
      ? Number((resultCounts.reduce((sum, value) => sum + value, 0) / successful.length).toFixed(2))
      : 0,
  };
}

async function main() {
  const catalog = readJson(CATALOG_PATH);
  const samples = selectBenchmarkProducts(catalog.products || []);
  const startedAt = new Date().toISOString();
  const providerRuns = {};

  console.log(`Benchmarking ${samples.length} products with providers: ${PROVIDERS.join(', ')}`);
  console.log(`Provisional quote rule: factory floor price + ¥${DEFAULT_MARKUP_CNY}`);
  for (const provider of PROVIDERS) {
    const searcher = SEARCHERS[provider];
    if (!searcher) {
      console.warn(`Unknown provider: ${provider}`);
      continue;
    }
    providerRuns[provider] = [];
    for (const sample of samples) {
      const started = Date.now();
      try {
        const response = await searcher(sample.query, DEFAULT_LIMIT);
        providerRuns[provider].push({
          product: sample,
          durationMs: Date.now() - started,
          ...response,
        });
        console.log(`[${provider}] ${sample.queryLabel}: ${response.results.length} results`);
      } catch (error) {
        providerRuns[provider].push({
          product: sample,
          provider,
          durationMs: Date.now() - started,
          results: [],
          error: error.message,
        });
        console.warn(`[${provider}] ${sample.queryLabel}: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  const report = {
    schemaVersion: 2,
    startedAt,
    completedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.generatedAt || null,
    providers: PROVIDERS,
    quotePolicy: {
      status: 'provisional',
      defaultMarkupCny: DEFAULT_MARKUP_CNY,
      formula: 'proposedQuoteCny = factoryFloorPriceCny + defaultMarkupCny',
      note: 'This is a temporary planning value. Replace with the actual submitted quote when available.',
    },
    sampleProducts: samples,
    summaries: Object.fromEntries(Object.entries(providerRuns).map(([provider, runs]) => [provider, summarizeProviderRuns(runs)])),
    runs: providerRuns,
    notes: [
      'This benchmark only measures discovery coverage and returned evidence. It does not treat search snippets as authoritative real-time Temu prices.',
      'Manual Temu verification should be performed on the same sample set before choosing the production provider.',
      'Firecrawl can run keyless. Tavily and Exa are only tested when their API keys are provided via environment variables or GitHub Secrets.',
      'proposedQuoteCny is provisional and currently equals factory floor price plus the configured markup; actualSubmittedQuoteCny and temuApprovedPriceCny remain null until real data is supplied.',
    ],
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const latestPath = path.join(OUTPUT_DIR, 'market-source-latest.json');
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Benchmark saved to ${latestPath}`);

  const allFailed = Object.values(providerRuns).flat().length > 0
    && Object.values(providerRuns).flat().every((run) => run.error);
  if (allFailed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
