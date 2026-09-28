import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  SCHEMA_VERSION,
  catalogHash,
  catalogToCsv,
  catalogToMarkdown,
  diffCatalog,
  mergeMissingProducts,
  normalizeProduct,
  updateHistory,
} from './lib/catalog.js';

const BASE_URL = process.env.TAOJIN_BASE_URL || 'https://taojinchuhai.cn/api';
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META_PATH = path.join(ROOT_DIR, 'public', 'data', 'sync-meta.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export async function fetchJsonWithRetry(url, fetchImpl = fetch, attempts = 3, wait = sleep, timeoutMs = 20000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'xuanpin-catalog-sync/1.0 (+https://github.com/chanayy123/xuanpin)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        error.stopSync = [401, 403, 429].includes(response.status);
        throw error;
      }
      const payload = await response.json();
      if (payload.code !== 0 || payload.success === false) throw new Error(payload.message || 'API 返回失败');
      return payload;
    } catch (error) {
      lastError = error;
      if (error.stopSync) throw error;
      if (attempt < attempts) await wait(300 * (2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export async function fetchAllGoods(fetchJson, baseUrl = BASE_URL, pageSize = 100) {
  const records = [];
  let sourceTotal = null;
  for (let pageNo = 1; pageNo <= 1000; pageNo += 1) {
    const url = `${baseUrl}/merchant/selection/goods/page?sortField=COMPREHENSIVE&sortOrder=DESC&pageNo=${pageNo}&pageSize=${pageSize}`;
    const payload = await fetchJson(url);
    const page = payload.data || {};
    if (!Array.isArray(page.records)) throw new Error(`第 ${pageNo} 页缺少 records，停止发布`);
    const pageRecords = page.records;
    const pageTotal = Number(page.total);
    if (!Number.isSafeInteger(pageTotal) || pageTotal <= 0) throw new Error('源站商品总数无效或为 0，停止发布');
    if (sourceTotal !== null && pageTotal !== sourceTotal) throw new Error(`分页总数变化：${sourceTotal} → ${pageTotal}，停止发布`);
    sourceTotal ??= pageTotal;
    if (pageRecords.some((item) => item.goodsId == null || String(item.goodsId).trim() === '')) throw new Error('分页商品缺少 ID，停止发布');
    records.push(...pageRecords);
    if (pageRecords.length === 0 || records.length >= sourceTotal) break;
  }
  const ids = records.map((item) => String(item.goodsId));
  if (!sourceTotal) throw new Error('源站商品总数为 0，停止发布');
  if (new Set(ids).size !== ids.length) throw new Error('分页结果包含重复商品 ID，停止发布');
  if (records.length !== sourceTotal) throw new Error(`分页不完整：期望 ${sourceTotal}，实际 ${records.length}`);
  return { sourceTotal, records };
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  let aborted = false;
  async function worker() {
    while (!aborted && cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try { results[index] = await mapper(items[index], index); }
      catch (error) { aborted = true; throw error; }
    }
  }
  const workers = await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  const failed = workers.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}

export async function runSync(options = {}) {
  const startedAt = new Date().toISOString();
  const rootDir = options.rootDir || ROOT_DIR;
  const catalogPath = path.join(rootDir, 'public/data/catalog.json');
  const metaPath = path.join(rootDir, 'public/data/sync-meta.json');
  const historyPath = path.join(rootDir, 'data/history.json');
  const baseUrl = options.baseUrl || BASE_URL;
  const previousCatalog = readJson(catalogPath, { products: [] });
  const previousProducts = Array.isArray(previousCatalog.products) ? previousCatalog.products : [];
  const previousMap = new Map(previousProducts.map((product) => [product.id, product]));
  const fetchSource = options.fetchJson || ((url) => fetchJsonWithRetry(url, options.fetchImpl || fetch));
  const evidence = [];
  const fetchJson = async (url) => {
    const payload = await fetchSource(url);
    const urlObject = new URL(url);
    const filename = urlObject.pathname.includes('/category/tree') ? 'category-tree.json'
      : urlObject.pathname.endsWith('/page') ? `goods-page-${urlObject.searchParams.get('pageNo')}.json`
        : `goods-detail-${urlObject.pathname.split('/').at(-2)}.json`;
    const sanitized = sanitizeEvidence(payload);
    const content = `${JSON.stringify(sanitized, null, 2)}\n`;
    evidence.push({ filename, url, observedAt: new Date().toISOString(), sha256: crypto.createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content), content });
    return payload;
  };

  const categoryPayload = await fetchJson(`${baseUrl}/merchant/selection/category/tree`);
  if (!Array.isArray(categoryPayload.data)) throw new Error('分类树结构无效，停止发布');
  const { sourceTotal, records } = await fetchAllGoods(fetchJson, baseUrl, 100);
  if (previousCatalog.sourceTotal && Math.abs(sourceTotal - previousCatalog.sourceTotal) / previousCatalog.sourceTotal > 0.30) {
    throw new Error(`商品数量单次变化超过 30%（${previousCatalog.sourceTotal} → ${sourceTotal}），停止发布`);
  }

  let detailFailures = 0;
  const details = await mapConcurrent(records, 3, async (record) => {
    try {
      const payload = await fetchJson(`${baseUrl}/goods/${record.goodsId}/detail`);
      if (String(payload.data?.goodsId) !== String(record.goodsId)) throw new Error(`商品 ${record.goodsId} 详情 ID 不一致`);
      return payload.data;
    } catch (error) {
      if (error.stopSync) throw error;
      detailFailures += 1;
      return { __error: error.message };
    }
  });
  if (detailFailures / sourceTotal > 0.05) throw new Error(`详情抓取失败率 ${(detailFailures / sourceTotal * 100).toFixed(1)}%，超过 5%`);

  const normalized = records.map((record, index) => normalizeProduct(
    record,
    details[index].__error ? {} : details[index],
    previousMap.get(String(record.goodsId)),
    startedAt,
  ));
  const products = mergeMissingProducts(normalized, previousProducts);
  const changes = diffCatalog(previousProducts, products);
  const hash = catalogHash(products);
  const previousHash = previousCatalog.catalogHash || (previousProducts.length ? catalogHash(previousProducts) : null);
  const catalogChanged = hash !== previousHash;
  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    source: 'https://taojinchuhai.cn/merchant/selection',
    sourceTotal,
    activeCount: products.filter((product) => product.active).length,
    generatedAt: catalogChanged ? startedAt : (previousCatalog.generatedAt || startedAt),
    catalogHash: hash,
    categories: categoryPayload.data || [],
    products,
  };
  const completedAt = new Date().toISOString();
  const syncMeta = {
    schemaVersion: SCHEMA_VERSION,
    status: 'success',
    startedAt,
    completedAt,
    lastSuccessAt: completedAt,
    sourceTotal,
    fetchedRecords: records.length,
    detailSuccess: sourceTotal - detailFailures,
    detailFailures,
    catalogChanged,
    changeCount: changes.length,
    catalogHash: hash,
    warnings: detailFailures ? [`${detailFailures} 个商品详情抓取失败，使用列表字段降级`] : [],
  };
  const history = updateHistory(readJson(historyPath, {}), changes, completedAt);

  // Raw evidence contains only public response bodies, never request headers or a browser session.
  const sourceDir = path.join(rootDir, 'data/source/latest');
  const nextSourceDir = `${sourceDir}.next`;
  fs.rmSync(nextSourceDir, { recursive: true, force: true });
  fs.mkdirSync(nextSourceDir, { recursive: true });
  for (const item of evidence) writeAtomic(path.join(nextSourceDir, item.filename), item.content);
  const manifest = { schemaVersion: 1, source: baseUrl, observedAt: completedAt, sourceTotal, fetchedRecords: records.length, detailFailures, sanitization: 'Sensitive field names redacted recursively; no session or request headers collected.', files: evidence.map(({ content, ...item }) => item).sort((a, b) => a.filename.localeCompare(b.filename)) };
  writeAtomic(path.join(nextSourceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.renameSync(nextSourceDir, sourceDir);
  writeAtomic(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  writeAtomic(metaPath, `${JSON.stringify(syncMeta, null, 2)}\n`);
  writeAtomic(historyPath, `${JSON.stringify(history, null, 2)}\n`);
  writeAtomic(path.join(rootDir, 'public/data/products.csv'), catalogToCsv(catalog));
  writeAtomic(path.join(rootDir, 'public/data/selection-report.md'), catalogToMarkdown(catalog, syncMeta));
  writeAtomic(path.join(rootDir, 'public/data/source-evidence.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`同步完成：源站 ${sourceTotal} 款，详情成功 ${sourceTotal - detailFailures} 款，变化 ${changes.length} 项。`);
  return { catalog, syncMeta, history, changes };
}

export function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /(^|[_-])(password|token|authorization|cookie|secret|phone|mobile|email|session)([_-]|$)|accessToken|refreshToken|contactPhone/i.test(key)
      ? '[REDACTED]' : sanitizeEvidence(item),
  ]));
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runSync().catch((error) => {
    const failedAt = new Date().toISOString();
    const previousMeta = readJson(META_PATH, {});
    writeAtomic(META_PATH, `${JSON.stringify({
      ...previousMeta,
      status: 'failed',
      lastAttemptAt: failedAt,
      error: error.message,
    }, null, 2)}\n`);
    console.error(`同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
