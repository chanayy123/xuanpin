import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessProduct,
  mergeMissingProducts,
  normalizeProduct,
  updateHistory,
} from '../scripts/lib/catalog.js';
import { fetchAllGoods, fetchJsonWithRetry } from '../scripts/sync_catalog.js';

const observedAt = '2026-08-30T00:00:00.000Z';

function makeRecord(overrides = {}) {
  return {
    goodsId: 94,
    goodsTitle: '节日 涤纶 圣诞椅套',
    priceMin: 12.6,
    priceMax: 35.8,
    weightMin: 218,
    weightMax: 626,
    deliveryTime: 0,
    deliveryTimeText: '24小时发货',
    selfDeliveryWarehouseText: '义乌仓自送',
    platformNames: ['Temu'],
    coverImageUrl: 'https://example.com/94.jpg',
    ...overrides,
  };
}

function makeDetail(overrides = {}) {
  return {
    goodsId: 94,
    goodsTitle: '节日 涤纶 圣诞椅套',
    categoryId: 298,
    categoryName: '圣诞椅套',
    categoryBreadcrumbs: [{ categoryId: 144, categoryName: '节日派对' }],
    material: '涤纶',
    craft: '热转印',
    deliveryTimeText: '24小时发货',
    platformNames: ['Temu'],
    carousels: [{ imageUrl: 'https://example.com/94-2.jpg' }],
    skus: [
      { id: 1, supplyPrice: 12.6, costPrice: 12.6, weight: 218, length: 26, width: 22, height: 3, specValues: [{ specName: '数量', specValue: '2PC' }] },
      { id: 2, supplyPrice: 35.8, costPrice: 35.8, weight: 626, length: 32, width: 27, height: 8, specValues: [{ specName: '数量', specValue: '6PC' }] },
    ],
    ...overrides,
  };
}

test('规范化时优先使用 priceMin 和 SKU 真实价格，不生成默认成本', () => {
  const product = normalizeProduct(makeRecord(), makeDetail(), null, observedAt);
  assert.equal(product.price.minCny, 12.6);
  assert.equal(product.price.maxCny, 35.8);
  assert.equal(product.weight.maxG, 626);
  assert.equal(product.material, '涤纶');
  assert.equal(product.assessment.marketPriceUsd, null);
  assert.equal(product.assessment.estimatedMargin, null);
});

test('评分是确定性的，且没有市场证据时不生成销量或利润', () => {
  const product = normalizeProduct(makeRecord(), makeDetail(), null, observedAt);
  assert.deepEqual(assessProduct(product), assessProduct(product));
  assert.equal(product.assessment.marketEvidence, null);
  assert.equal(product.assessment.demandSignal, null);
  assert.equal(product.assessment.competitionSignal, null);
});

test('关键资料缺失时即使其他维度分数较高也必须谨慎评估', () => {
  const product = normalizeProduct(
    makeRecord({ priceMin: undefined, priceMax: undefined }),
    makeDetail({ skus: makeDetail().skus.map((sku) => ({ ...sku, supplyPrice: undefined, costPrice: undefined })) }),
    null,
    observedAt,
  );
  assert.equal(product.price.minCny, null);
  assert.equal(product.assessment.status, '谨慎评估');
  assert.ok(product.assessment.risks.some((risk) => risk.includes('关键资料')));
});

test('烟具商品始终进入合规复核，不进入优先推荐', () => {
  const product = normalizeProduct(
    makeRecord({ goodsId: 78, goodsTitle: '1PC 金属 平顶打火机壳' }),
    makeDetail({ goodsId: 78, goodsTitle: '1PC 金属 平顶打火机壳', categoryName: '烟具配件', material: '金属', craft: 'UV打印' }),
    null,
    observedAt,
  );
  assert.equal(product.assessment.status, '合规复核');
  assert.ok(product.assessment.risks.some((risk) => risk.includes('合规')));
});

test('商品连续缺失两次后才标记下架', () => {
  const product = normalizeProduct(makeRecord(), makeDetail(), null, observedAt);
  const first = mergeMissingProducts([], [product]);
  assert.equal(first[0].active, true);
  assert.equal(first[0].missingRuns, 1);
  const second = mergeMissingProducts([], first);
  assert.equal(second[0].active, false);
  assert.equal(second[0].missingRuns, 2);
});

test('分页抓取覆盖超过 100 款商品并校验 total', async () => {
  const all = Array.from({ length: 205 }, (_, index) => ({ goodsId: index + 1 }));
  const fetchJson = async (url) => {
    const parsed = new URL(url);
    const pageNo = Number(parsed.searchParams.get('pageNo'));
    const pageSize = Number(parsed.searchParams.get('pageSize'));
    const start = (pageNo - 1) * pageSize;
    return { code: 0, data: { total: all.length, records: all.slice(start, start + pageSize) } };
  };
  const result = await fetchAllGoods(fetchJson, 'https://example.com/api', 100);
  assert.equal(result.sourceTotal, 205);
  assert.equal(result.records.length, 205);
});

test('分页出现重复商品 ID 时阻止发布', async () => {
  const pages = [
    [{ goodsId: 1 }, { goodsId: 2 }],
    [{ goodsId: 2 }],
  ];
  const fetchJson = async (url) => {
    const pageNo = Number(new URL(url).searchParams.get('pageNo'));
    return { code: 0, data: { total: 3, records: pages[pageNo - 1] || [] } };
  };
  await assert.rejects(() => fetchAllGoods(fetchJson, 'https://example.com/api', 2), /重复商品 ID/);
});

test('接口超时后按最多三次重试并可恢复', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) throw new Error('timeout');
    return { ok: true, json: async () => ({ code: 0, success: true, data: {} }) };
  };
  const waits = [];
  const payload = await fetchJsonWithRetry('https://example.com/api', fetchImpl, 3, async (ms) => waits.push(ms));
  assert.equal(payload.code, 0);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [300, 600]);
});

test('66 款历史快照与当前 82+ 款规范目录都保持可校验结构', () => {
  const legacy = JSON.parse(fs.readFileSync(new URL('../products_raw.json', import.meta.url), 'utf8'));
  const current = JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'));
  assert.equal(legacy.total, 66);
  assert.equal(legacy.products.length, 66);
  assert.ok(current.sourceTotal >= 82);
  assert.equal(current.products.length, current.sourceTotal);
  assert.ok(current.products.every((product) => product.price && product.weight && product.assessment && product.sourceUrl));
});

test('历史只保留最近 180 天并仅记录变化事件', () => {
  const history = {
    events: [
      { observedAt: '2025-01-01T00:00:00.000Z', changes: [{ id: '1' }] },
      { observedAt: '2026-08-01T00:00:00.000Z', changes: [{ id: '2' }] },
    ],
  };
  const next = updateHistory(history, [{ type: 'added', id: '3' }], '2026-08-30T00:00:00.000Z');
  assert.equal(next.events.length, 2);
  assert.equal(next.events[1].changes[0].id, '3');
});
