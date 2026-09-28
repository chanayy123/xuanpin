import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCategoryRankings, normalizeRankingSku, numberOrNull, RANKING_STRATEGIES } from '../scripts/lib/category-ranking.js';
import { buildRankingFiles, rankingCsv, shanghaiDate, updateRankingHistory } from '../scripts/build_rankings.js';

const playbooks = { groups: [
  { id: 'bags', name: '袋', sourceCategories: ['化妆包'], workflowFit: 100, operationalEase: 90 },
  { id: 'pillow', name: '抱枕套', sourceCategories: ['方形抱枕套'], workflowFit: 100, operationalEase: 90, isControl: true },
] };
function sku(id, price, weight, dimensions = { lengthCm: 10, widthCm: 10, heightCm: 1 }) {
  return { id, supplyPriceCny: price, weightG: weight, dimensions, specs: [{ name: '数量', value: '1PC' }] };
}
function product(id = '1', overrides = {}) {
  return { id, title: '拉链化妆包', category: { id: '161', name: '化妆包' }, active: true, skus: [sku('small', 3, 28)], craft: '热转印', sourceUrl: `https://example.com/${id}`, delivery: { text: '24小时发货' }, ...overrides };
}
function build(products, options = {}) {
  return buildCategoryRankings({ products, sourceTotal: products.length, generatedAt: '2026-09-28T00:00:00Z' }, { playbooks, ...options });
}

test('同一输入可复现且重排输入商品或SKU不影响排序和同SKU选择', () => {
  const p1 = product('2', { skus: [sku('large', 15, 500), sku('small', 3, 28)] });
  const p2 = product('1');
  const first = build([p1, p2]);
  const reversed = build([p2, { ...p1, skus: [...p1.skus].reverse() }]);
  assert.deepEqual(first, reversed);
  assert.deepEqual(first.categories.map((c) => [c.id, c.score, c.productIds]), reversed.categories.map((c) => [c.id, c.score, c.productIds]));
  assert.deepEqual(first.categories[0].products.map((p) => p.selectedSku), reversed.categories[0].products.map((p) => p.selectedSku));
  assert.deepEqual(first, build([p1, p2]));
});

test('null、空白及布尔值不变成0；缺少物流和报价不会获得候选名次', () => {
  for (const value of [null, undefined, '', '  ', false, true]) assert.equal(numberOrNull(value), null);
  const report = build([product('1', { skus: [sku('missing', null, null, { lengthCm: null, widthCm: null, heightCm: null })] })]);
  const c = report.categories[0];
  assert.equal(c.status, 'needs_data');
  assert.equal(c.rank, null);
  assert.equal(c.dimensions.costEfficiency.score, null);
  assert.equal(c.dimensions.logistics.score, null);
  assert.equal(c.stats.supplyPriceCny.median, null);
  assert.equal(c.recommendedProducts[0].selectedSku.supplyPriceCny, null);
  assert.equal(c.marketEvidence.margin, null);
});

test('价格和重量来自真实同一SKU，优先完整SKU，不能拼接最低报价与其他SKU物流', () => {
  const skus = [sku('incomplete-cheap', 1, null), sku('small', 5, 90), sku('large', 20, 2000)];
  const chosen = build([product('1', { skus })]).categories[0].recommendedProducts[0].selectedSku;
  assert.equal(chosen.id, 'small');
  assert.equal(chosen.supplyPriceCny, 5);
  assert.equal(chosen.weightG, 90);
  assert.equal(chosen.referenceWeightG, 90);
});

test('同分推荐优先较低同SKU供货价，再较低物流参考重', () => {
  const report = build([
    product('1', { skus: [sku('x', 3.3, 50)] }),
    product('2', { skus: [sku('x', 3, 60)] }),
    product('3', { skus: [sku('x', 3, 40)] }),
  ]);
  assert.deepEqual(report.categories[0].recommendedProducts.map((p) => p.id), ['3', '2', '1']);
});

test('体积重必须同SKU有完整正数三边和实重；不由缺字段推断轻量', () => {
  assert.equal(normalizeRankingSku(sku('x', 3, 20, { lengthCm: 50, widthCm: 30, heightCm: 10 })).referenceWeightG, 3000);
  assert.equal(normalizeRankingSku(sku('x', 3, 20, { lengthCm: 50, widthCm: 30, heightCm: null })).referenceWeightG, null);
  assert.equal(normalizeRankingSku(sku('x', 3, null)).referenceWeightG, null);
  assert.equal(normalizeRankingSku(sku('x', 3, 20, { lengthCm: 10, widthCm: 10, heightCm: 1 }), 1000).referenceWeightG, 100);
});

test('烟具用途进入复核，抱枕套保留对照，新类目待运营判断，不挤入候选', () => {
  const report = build([
    product('1'),
    product('2', { title: '打火机收纳化妆包' }),
    product('3', { title: '抱枕套', category: { id: '74', name: '方形抱枕套' } }),
    product('4', { title: '新商品', category: { id: 'new', name: '新类目' } }),
  ]);
  assert.equal(report.categories.find((c) => c.id === 'bags').status, 'review');
  assert.equal(report.categories.find((c) => c.id === 'pillow').status, 'control');
  assert.equal(report.categories.find((c) => c.id === 'source-new').status, 'needs_data');
  assert.ok(report.categories.every((c) => c.rank === null));
});

test('缺项商品不参加综合分和维度中位数，缺失超过半数时不授候选名次', () => {
  const missing = product('2', { skus: [sku('missing', null, null)] });
  const report = build([product('1'), missing]);
  const c = report.categories[0];
  assert.equal(c.dimensions.costEfficiency.knownCount, 1);
  assert.equal(c.dimensions.costEfficiency.score, 100);
  assert.equal(c.stats.entrySupplyPriceCny.median, 3);
  assert.equal(c.confidence.marketCoveragePct, 0);
  assert.equal(build([product('1'), missing, { ...missing, id: '3' }]).categories[0].status, 'needs_data');
});

test('缺工艺或发货字段不能通过剩余强项获得高分候选', () => {
  for (const overrides of [{ craft: null }, { delivery: {} }, { sourceUrl: null }]) {
    const report = build([product('1', overrides)]);
    assert.equal(report.categories[0].status, 'needs_data');
    assert.equal(report.categories[0].rank, null);
    assert.equal(report.categories[0].score, null);
    assert.equal(report.categories[0].products[0].score, null);
  }
});

test('策略权重可切换且不修改源目录或引入销量/利润', () => {
  const products = [product('1')];
  const original = structuredClone(products);
  for (const strategy of RANKING_STRATEGIES) {
    const report = build(products, { strategy: strategy.id });
    assert.equal(report.selectedStrategy, strategy.id);
    assert.equal(Object.values(report.weights).reduce((a, b) => a + b), 100);
    assert.equal(report.categories[0].marketEvidence.demand, null);
    assert.equal(report.summary.salesAnalysisReady, false);
  }
  assert.deepEqual(products, original);
});

test('真实目录每个有效商品仅分组一次，修正源站错分且保留映射和已上架对照', () => {
  const catalog = JSON.parse(fs.readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8'));
  const actualPlaybooks = JSON.parse(fs.readFileSync(new URL('../data/category-playbooks.json', import.meta.url), 'utf8'));
  const report = buildCategoryRankings(catalog, { playbooks: actualPlaybooks });
  const ids = report.categories.flatMap((c) => c.productIds);
  const expected = catalog.products.filter((p) => p.active !== false).map((p) => String(p.id)).sort();
  assert.deepEqual([...ids].sort(), expected);
  assert.equal(new Set(ids).size, expected.length);
  assert.equal(report.scope.coveredProductCount, expected.length);
  assert.equal(report.categories.find((c) => c.id === 'table-runners').sourceCategories[0].name, '餐垫');
  assert.deepEqual(report.categories.find((c) => c.id === 'rainwear').productIds, ['39']);
  assert.equal(report.categories.find((c) => c.id === 'pillow-covers').status, 'control');
  assert.ok(report.categories.filter((c) => c.status === 'candidate').every((c) => c.products.every((p) => !/打火机|烟灰缸|烟盒|火柴盒/.test(p.title))));
  assert.ok(report.categories.every((c) => c.marketEvidence.demand === null && c.marketEvidence.margin === null));
});

test('失效商品不进入当前覆盖和排序', () => {
  const report = build([product('1'), product('2', { active: false })]);
  assert.deepEqual(report.categories[0].productIds, ['1']);
  assert.equal(report.scope.inactiveExcludedCount, 1);
});

test('本轮缺席但尚未判下架的商品等待供货复核，不贡献当前得分和报价范围', () => {
  const report = build([product('1', { missingRuns: 1 })]);
  const c = report.categories[0];
  assert.equal(c.status, 'needs_data');
  assert.equal(c.score, null);
  assert.equal(c.stats.supplyPriceCny.count, 0);
  assert.equal(c.products[0].selectedSku.supplyPriceCny, 3);
  assert.equal(c.products[0].observedCurrent, false);
  assert.equal(report.scope.awaitingPresenceReviewCount, 1);
  assert.equal(report.scope.currentObservedProductCount, 0);
});

test('只有同模型同权重同运营判断可比较名次，首版不会伪造新增或涨跌', () => {
  const extraPlaybooks = { groups: [...playbooks.groups, { id: 'flags', name: '旗', sourceCategories: ['旗'], workflowFit: 100, operationalEase: 90 }] };
  const products = [product('1'), product('2', { category: { id: 'flag', name: '旗' }, skus: [sku('flag', 10, 120)] })];
  const prior = build(products, { playbooks: extraPlaybooks });
  assert.equal(prior.comparison.available, false);
  assert.ok(prior.categories.every((c) => c.previousRank === null && c.rankChange === null));
  const changed = build([product('1', { skus: [sku('cost-up', 25, 400)] }), products[1]], { playbooks: extraPlaybooks, previousReport: prior });
  assert.equal(changed.comparison.available, true);
  assert.equal(changed.categories.find((c) => c.id === 'flags').rankChange, 1);
  assert.equal(changed.categories.find((c) => c.id === 'bags').rankChange, -1);
  assert.equal(changed.summary.rankChanges.movedUp, 1);
  assert.equal(build(products, { playbooks: extraPlaybooks, previousReport: prior, strategy: 'budget' }).comparison.available, false);
  assert.equal(build(products, { playbooks: { groups: extraPlaybooks.groups.map((g) => ({ ...g, operationalEase: 50 })) }, previousReport: prior }).comparison.available, false);
});

test('上海日期基线同日只保留一份，保留前日且过期快照被清理', () => {
  assert.equal(shanghaiDate('2026-09-27T16:01:00Z'), '2026-09-28');
  const initial = build([product('1')], { generatedAt: '2026-09-27T01:00:00Z' });
  const firstHistory = updateRankingHistory({ snapshots: [{ date: '2025-01-01' }] }, initial);
  const today = build([product('1')], { generatedAt: '2026-09-28T01:00:00Z' });
  const secondHistory = updateRankingHistory(firstHistory, today);
  const rerun = updateRankingHistory(secondHistory, { ...today, generatedAt: '2026-09-28T03:00:00Z' });
  assert.deepEqual(rerun.snapshots.map((s) => s.date), ['2026-09-27', '2026-09-28']);
  assert.equal(rerun.snapshots[1].generatedAt, '2026-09-28T03:00:00Z');
  assert.deepEqual(updateRankingHistory(rerun, today, false), rerun);
});

test('CSV外部文本不会以可执行公式开头', () => {
  const report = build([product('1')]);
  report.categories[0].name = '=HYPERLINK("https://invalid")';
  report.categories[0].reasons = ['\t=1+1'];
  const csv = rankingCsv(report);
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes("'\t=1+1"));
  assert.ok(!csv.includes(',"=HYPERLINK'));
});

test('导出流程同日重跑保持首日基线，次日才引用上一采集日且采集时间来自同步元数据', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'category-ranking-test-'));
  try {
    fs.mkdirSync(path.join(rootDir, 'public/data'), { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'data'));
    const write = (name, value) => fs.writeFileSync(path.join(rootDir, name), JSON.stringify(value));
    write('data/category-playbooks.json', playbooks);
    write('public/data/catalog.json', { products: [product('1')], generatedAt: '2026-09-20T00:00:00Z' });
    write('public/data/sync-meta.json', { status: 'success', lastSuccessAt: '2026-09-28T01:00:00Z' });
    const first = buildRankingFiles({ rootDir, generatedAt: '2026-09-28T01:01:00Z' });
    const rerun = buildRankingFiles({ rootDir, generatedAt: '2026-09-28T03:00:00Z' });
    assert.equal(first.comparison.available, false);
    assert.equal(rerun.comparison.available, false);
    assert.equal(rerun.catalogObservedAt, '2026-09-28T01:00:00Z');
    assert.equal(rerun.catalogGeneratedAt, '2026-09-20T00:00:00Z');
    write('public/data/sync-meta.json', { status: 'success', lastSuccessAt: '2026-09-29T01:00:00Z' });
    const nextDay = buildRankingFiles({ rootDir, generatedAt: '2026-09-29T01:01:00Z' });
    assert.equal(nextDay.comparison.available, true);
    assert.equal(nextDay.comparison.previousGeneratedAt, rerun.generatedAt);
    assert.equal(nextDay.categories[0].rankChange, 0);
    assert.equal(nextDay.summary.rankChanges.unchanged, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
