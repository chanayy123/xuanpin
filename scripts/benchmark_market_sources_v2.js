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

// Benchmark rules are intentionally narrow. The goal is to test search-source quality,
// not to pretend a broad keyword match means the products are comparable.
const QUERY_RULES = [
  {
    label: 'car-headrest-cover',
    categoryPattern: /座椅头枕套/i,
    titlePattern: /(汽车.*头枕套|头枕套)/i,
    query: 'car seat headrest cover pair polyester printed',
    requiredGroups: [/(car|auto|vehicle|automotive)/i, /headrest/i, /(cover|protector)/i],
    excludedTerms: [/(decorative pillow|cushion cover|throw pillow)/i],
  },
  {
    label: 'cosmetic-bag',
    categoryPattern: /化妆包/i,
    titlePattern: /化妆包/i,
    query: 'linen zipper cosmetic makeup bag pouch printed',
    requiredGroups: [/(cosmetic|makeup)/i, /(bag|pouch)/i],
    excludedTerms: [/(toiletry bottle|makeup brush set)/i],
  },
  {
    label: 'drawstring-bag',
    categoryPattern: /束口袋/i,
    titlePattern: /(束口袋|抽绳包)/i,
    query: 'polyester drawstring gym bag printed cinch sack',
    requiredGroups: [/(drawstring|cinch|string bag)/i, /(bag|sack)/i],
    excludedTerms: [/(trash bag|laundry hamper)/i],
  },
  {
    label: 'canvas-tote',
    titlePattern: /(帆布.*(手提袋|包)|手提袋.*帆布)/i,
    query: 'canvas tote bag black handles printed reusable',
    requiredGroups: [/canvas/i, /(tote|handbag|shoulder bag)/i],
    excludedTerms: [/(leather|plastic tote)/i],
  },
  {
    label: 'beach-bag',
    categoryPattern: /沙滩包/i,
    titlePattern: /(沙滩包|海滩包)/i,
    query: 'polyester beach tote bag women printed',
    requiredGroups: [/(beach|pool)/i, /(tote|bag)/i],
    excludedTerms: [/(beach towel|cooler bag)/i],
  },
  {
    label: 'umbrella',
    categoryPattern: /晴雨伞/i,
    titlePattern: /(雨伞|晴雨伞|自动伞)/i,
    query: '8 rib automatic folding umbrella printed compact',
    requiredGroups: [/(umbrella)/i, /(automatic|folding|compact)/i],
    excludedTerms: [/(patio umbrella|beach umbrella|umbrella stand)/i],
  },
  {
    label: 'mouse-pad',
    categoryPattern: /方形鼠标垫/i,
    titlePattern: /鼠标垫/i,
    query: '3mm rubber square mouse pad printed non slip',
    requiredGroups: [/(mouse pad|mousepad|mouse mat)/i, /rubber/i],
    excludedTerms: [/(wrist rest|keyboard only)/i],
  },
  {
    label: 'shower-curtain-set',
    categoryPattern: /帘垫套装/i,
    titlePattern: /(浴室帘垫套装|浴帘.*地垫)/i,
    query: '4pcs shower curtain bathroom mat set printed polyester',
    requiredGroups: [/(shower curtain)/i, /(set|mat|rug|toilet)/i],
    excludedTerms: [/(curtain hooks only|liner only)/i],
  },
  {
    label: 'linen-placemat-set',
    categoryPattern: /餐垫/i,
    titlePattern: /餐垫/i,
    query: 'set of 4 linen placemats dining table printed',
    requiredGroups: [/(placemat|place mat)/i, /(set|4pcs|4 pack|four)/i],
    excludedTerms: [/(table runner|tablecloth)/i],
  },
  {
    label: 'golf-towel',
    categoryPattern: /高尔夫毛巾/i,
    titlePattern: /高尔夫.*毛巾/i,
    query: 'golf towel with hole clip carabiner printed',
    requiredGroups: [/golf/i, /towel/i],
    excludedTerms: [/(beach towel|bath towel|kitchen towel)/i],
  },
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
    actualSubmittedQuoteCny: null,
    temuApprovedPriceCny: null,
  };
}

function matchesRule(product, rule) {
  const title = product.title || '';
  const category = product.category?.name || '';
  const categoryOk = rule.categoryPattern ? rule.categoryPattern.test(category) : true;
  const titleOk = rule.titlePattern ? rule.titlePattern.test(title) : true;
  return categoryOk && titleOk;
}

function selectBenchmarkProducts(products) {
  const active = products.filter((product) => product.active !== false);
  const selected = [];
  const used = new Set();

  for (const rule of QUERY_RULES) {
    const product = active.find((item) => !used.has(item.id) && matchesRule(item, rule));
    if (!product) continue;
    used.add(product.id);
    const factoryFloorPriceCny = product.price?.minCny ?? null;
    selected.push({
      id: product.id,
      title: product.title,
      category: product.category?.name || '',
      factoryFloorPriceCny,
      ...quoteFields(factoryFloorPriceCny),
      queryLabel: rule.label,
      query: `site:temu.com ${rule.query}`,
      requiredGroups: rule.requiredGroups.map((group) => group.source),
      excludedTerms: rule.excludedTerms.map((term) => term.source),
    });
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

const SEARCHERS = { firecrawl: searchFirecrawl, tavily: searchTavily, exa: searchExa };

function classifyTemuUrl(url) {
  try {
    const parsed = new URL(url);
    const isTemu = /(^|\.)temu\.com$/i.test(parsed.hostname);
    const firstSegment = parsed.pathname.split('/').filter(Boolean)[0] || '';
    const localePrefix = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(firstSegment) ? firstSegment : null;
    const resultKind = /-g-\d+\.html$/i.test(parsed.pathname) ? 'product'
      : /-s\.html$/i.test(parsed.pathname) ? 'search-page'
        : 'other';
    return { isTemu, localePrefix, resultKind };
  } catch {
    return { isTemu: false, localePrefix: null, resultKind: 'invalid-url' };
  }
}

function extractSnippetEvidence(text) {
  const prices = [...text.matchAll(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g)].map((match) => Number(match[1]));
  const rating = text.match(/Rating\s*([0-5](?:\.\d)?)/i);
  const reviews = text.match(/Rating\s*[0-5](?:\.\d)?\s*\(([0-9,]+)\)/i);
  const sold = text.match(/([0-9,.]+\s*[kKmM]?\+?)\s*(?:sold|sales)/i);
  return {
    priceUsdCandidates: [...new Set(prices)].slice(0, 8),
    rating: rating ? Number(rating[1]) : null,
    reviewCount: reviews ? Number(reviews[1].replaceAll(',', '')) : null,
    soldText: sold ? sold[1] : null,
  };
}

function assessSameProduct(result, rule) {
  const text = `${result.title} ${result.snippet}`;
  const groupHits = rule.requiredGroups.map((regex) => regex.test(text));
  const hitCount = groupHits.filter(Boolean).length;
  const excludedHits = rule.excludedTerms.filter((regex) => regex.test(text)).map((regex) => regex.source);
  let level = 'weak';
  if (!excludedHits.length && hitCount === rule.requiredGroups.length) level = 'strong';
  else if (!excludedHits.length && hitCount >= Math.max(1, rule.requiredGroups.length - 1)) level = 'medium';
  return {
    level,
    requiredHitCount: hitCount,
    requiredGroupCount: rule.requiredGroups.length,
    excludedHits,
  };
}

function enrichResults(results, rule) {
  return results.map((result) => ({
    ...result,
    ...classifyTemuUrl(result.url),
    sameProduct: assessSameProduct(result, rule),
    snippetEvidence: extractSnippetEvidence(`${result.title} ${result.snippet}`),
  }));
}

function summarizeRuns(runs) {
  const successful = runs.filter((run) => !run.error);
  const results = successful.flatMap((run) => run.results);
  const strong = results.filter((result) => result.sameProduct?.level === 'strong');
  const directProducts = results.filter((result) => result.resultKind === 'product');
  const strongDirect = results.filter((result) => result.resultKind === 'product' && result.sameProduct?.level === 'strong');
  return {
    queries: runs.length,
    successfulQueries: successful.length,
    failedQueries: runs.length - successful.length,
    totalResults: results.length,
    temuResults: results.filter((result) => result.isTemu).length,
    directProductResults: directProducts.length,
    strongSameProductResults: strong.length,
    strongDirectProductResults: strongDirect.length,
    nonRootLocaleResults: results.filter((result) => result.localePrefix).length,
  };
}

async function main() {
  const catalog = readJson(CATALOG_PATH);
  const samples = selectBenchmarkProducts(catalog.products || []);
  if (!samples.length) throw new Error('No strict benchmark samples matched the current catalog.');

  const rulesByLabel = new Map(QUERY_RULES.map((rule) => [rule.label, rule]));
  const startedAt = new Date().toISOString();
  const providerRuns = {};

  console.log(`Benchmarking ${samples.length} strict products with providers: ${PROVIDERS.join(', ')}`);
  for (const provider of PROVIDERS) {
    const searcher = SEARCHERS[provider];
    if (!searcher) continue;
    providerRuns[provider] = [];
    for (const sample of samples) {
      const started = Date.now();
      try {
        const response = await searcher(sample.query, DEFAULT_LIMIT);
        const rule = rulesByLabel.get(sample.queryLabel);
        const results = enrichResults(response.results, rule);
        providerRuns[provider].push({
          product: sample,
          provider,
          durationMs: Date.now() - started,
          usage: response.usage,
          results,
        });
        const strongDirect = results.filter((result) => result.resultKind === 'product' && result.sameProduct.level === 'strong').length;
        console.log(`[${provider}] ${sample.queryLabel}: ${results.length} results, ${strongDirect} strong direct products`);
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
    quotePolicy: {
      provisionalMarkupCny: DEFAULT_MARKUP_CNY,
      note: 'Provisional quote only. Replace with actual submitted quote and Temu approved price when available.',
    },
    providers: PROVIDERS,
    sampleProducts: samples,
    summaries: Object.fromEntries(Object.entries(providerRuns).map(([provider, runs]) => [provider, summarizeRuns(runs)])),
    runs: providerRuns,
    notes: [
      'Search snippets are discovery evidence, not authoritative real-time Temu price facts.',
      'Only direct product URLs with strong same-product signals should be considered candidate market evidence.',
      'Locale-prefixed Temu URLs are tracked separately because the target comparison market is the United States.',
      'The benchmark intentionally uses strict category-aware mappings to avoid false comparisons such as car headrest covers vs decorative pillow covers.',
    ],
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const latestPath = path.join(OUTPUT_DIR, 'market-source-latest-v2.json');
  fs.writeFileSync(latestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Benchmark saved to ${latestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
