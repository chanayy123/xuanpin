import fs from 'node:fs';
import path from 'node:path';
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
const CATALOG_PATH = path.join(ROOT_DIR, 'public', 'data', 'catalog.json');
const META_PATH = path.join(ROOT_DIR, 'public', 'data', 'sync-meta.json');
const CSV_PATH = path.join(ROOT_DIR, 'public', 'data', 'products.csv');
const REPORT_PATH = path.join(ROOT_DIR, 'public', 'data', 'selection-report.md');
const HISTORY_PATH = path.join(ROOT_DIR, 'data', 'history.json');

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

export async function fetchJsonWithRetry(url, fetchImpl = fetch, attempts = 3, wait = sleep) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': 'xuanpin-catalog-sync/1.0 (+https://github.com/chanayy123/xuanpin)',
          Accept: 'application/json',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const payload = await response.json();
      if (payload.code !== 0 || payload.success === false) throw new Error(payload.message || 'API 返回失败');
      return payload;
    } catch (error) {
      lastError = error;
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
    const pageRecords = Array.isArray(page.records) ? page.records : [];
    sourceTotal ??= Number(page.total || 0);
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
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function runSync(options = {}) {
  const startedAt = new Date().toISOString();
  const previousCatalog = readJson(CATALOG_PATH, { products: [] });
  const previousProducts = Array.isArray(previousCatalog.products) ? previousCatalog.products : [];
  const previousMap = new Map(previousProducts.map((product) => [product.id, product]));
  const fetchJson = options.fetchJson || ((url) => fetchJsonWithRetry(url, options.fetchImpl || fetch));

  const categoryPayload = await fetchJson(`${BASE_URL}/merchant/selection/category/tree`);
  const { sourceTotal, records } = await fetchAllGoods(fetchJson, BASE_URL, 100);
  if (previousCatalog.sourceTotal && Math.abs(sourceTotal - previousCatalog.sourceTotal) / previousCatalog.sourceTotal > 0.30) {
    throw new Error(`商品数量单次变化超过 30%（${previousCatalog.sourceTotal} → ${sourceTotal}），停止发布`);
  }

  let detailFailures = 0;
  const details = await mapConcurrent(records, 3, async (record) => {
    try {
      const payload = await fetchJson(`${BASE_URL}/goods/${record.goodsId}/detail`);
      return payload.data || {};
    } catch (error) {
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
  const history = updateHistory(readJson(HISTORY_PATH, {}), changes, completedAt);

  writeAtomic(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  writeAtomic(META_PATH, `${JSON.stringify(syncMeta, null, 2)}\n`);
  writeAtomic(HISTORY_PATH, `${JSON.stringify(history, null, 2)}\n`);
  writeAtomic(CSV_PATH, catalogToCsv(catalog));
  writeAtomic(REPORT_PATH, catalogToMarkdown(catalog, syncMeta));

  console.log(`同步完成：源站 ${sourceTotal} 款，详情成功 ${sourceTotal - detailFailures} 款，变化 ${changes.length} 项。`);
  return { catalog, syncMeta, history, changes };
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
