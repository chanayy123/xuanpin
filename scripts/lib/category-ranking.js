// This module is intentionally browser-compatible: the same evidence and rules
// power the static report and the interactive strategy switcher.
// Increment when scoring or interpretation changes; different versions cannot
// be used as a daily rank-movement comparison.
export const RANKING_VERSION = 1;

export const RANKING_DIMENSIONS = [
  { id: 'workflowFit', name: 'POD 工作流适配', description: '品类运营判断与源站印花工艺结合；不代表印花效果已验收。' },
  { id: 'costEfficiency', name: '供货投入', description: '每款选定完整 SKU 的供货报价评分；未包含运费、包装或售后。' },
  { id: 'logistics', name: '物流轻便度', description: '同一 SKU 的实重与尺寸体积重参考值；尺寸是否为最终包装仍须确认。' },
  { id: 'operations', name: '运营与售后复杂度', description: 'SKU 数量与用途、适配和质量验证复杂度的运营先验。' },
  { id: 'fulfillment', name: '源站发货承诺', description: '仅按供应商页面发货时效，不代表跨境送达或履约率。' },
];

export const RANKING_STRATEGIES = [
  { id: 'pod', name: '低成本 POD', description: '优先复用现有布艺图案与样机流程，兼顾供货投入、物流和操作复杂度。', weights: { workflowFit: 30, costEfficiency: 25, logistics: 20, operations: 20, fulfillment: 5 } },
  { id: 'budget', name: '小预算试款', description: '提高供货成本权重；低供货价仍不等于可盈利。', weights: { workflowFit: 20, costEfficiency: 40, logistics: 20, operations: 15, fulfillment: 5 } },
  { id: 'logistics', name: '物流优先', description: '提高同 SKU 重量与体积参考值权重。', weights: { workflowFit: 20, costEfficiency: 15, logistics: 40, operations: 20, fulfillment: 5 } },
];

const KEYS = RANKING_DIMENSIONS.map(({ id }) => id);
const PRINT = /(热转印|热成印|UV|印花|喷绘|丝印|刺绣|烫画|升华|雕刻)/i;
const RESTRICTED = /(打火机|烟灰缸|烟盒|烟具|火柴盒)/i;
const nonEmpty = (value) => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean';
export function numberOrNull(value) {
  if (!nonEmpty(value) || (typeof value === 'string' && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const positive = (value) => { const n = numberOrNull(value); return n != null && n > 0 ? n : null; };
const round = (value, digits = 1) => value == null ? null : Number(value.toFixed(digits));
const compareIds = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const unique = (values) => [...new Set(values.filter(Boolean))];
const clamp = (value) => Math.max(0, Math.min(100, value));
function median(values) {
  const sorted = values.filter((value) => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2, 2);
}
function range(values) {
  const valid = values.filter((value) => value != null && Number.isFinite(value));
  return { min: valid.length ? Math.min(...valid) : null, median: median(valid), max: valid.length ? Math.max(...valid) : null, count: valid.length };
}
function thresholdScore(value, thresholds) {
  if (value == null) return null;
  return thresholds.find(([upper]) => value <= upper)?.[1] ?? 10;
}
function normalizeWeights(weights) {
  const valid = Object.fromEntries(KEYS.map((key) => [key, Math.max(0, numberOrNull(weights[key]) ?? 0)]));
  const sum = Object.values(valid).reduce((acc, value) => acc + value, 0);
  if (!sum) return { ...RANKING_STRATEGIES[0].weights };
  return Object.fromEntries(KEYS.map((key) => [key, round(valid[key] / sum * 100, 4)]));
}
function weightedScore(components, weights) {
  let total = 0;
  let knownWeight = 0;
  for (const key of KEYS) {
    if (components[key] == null) continue;
    total += components[key] * weights[key];
    knownWeight += weights[key];
  }
  return knownWeight ? round(total / knownWeight) : null;
}

export function normalizeRankingSku(sku = {}, divisor = 5000) {
  const dimensions = Object.fromEntries(['lengthCm', 'widthCm', 'heightCm'].map((key) => [key, positive(sku.dimensions?.[key])]));
  const weightG = positive(sku.weightG);
  const hasDimensions = Object.values(dimensions).every((value) => value != null);
  const volumetricWeightG = hasDimensions ? round(dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm / divisor * 1000) : null;
  const specs = Array.isArray(sku.specs) ? sku.specs.map((spec) => ({ name: String(spec.name || ''), value: String(spec.value || '') })) : [];
  const countSpec = specs.find((spec) => /数量|套数|件数/.test(spec.name));
  const countMatch = countSpec?.value.match(/(\d+)\s*(?:PCS?|件|个|片)/i);
  return {
    id: String(sku.id ?? ''), supplyPriceCny: positive(sku.supplyPriceCny), weightG, dimensions,
    volumetricWeightG, referenceWeightG: weightG != null && volumetricWeightG != null ? round(Math.max(weightG, volumetricWeightG)) : null,
    weightBasis: `max(source SKU actual weight, source SKU L×W×H/${divisor}); package dimensions unverified`,
    specs, specLabel: specs.map((spec) => `${spec.name}：${spec.value}`).join('；'),
    packUnits: countMatch ? Number(countMatch[1]) : null,
  };
}

function selectSku(skus) {
  // Choose a real complete quotation. Never splice a product's price minimum
  // together with a different SKU's maximum weight.
  const sorted = [...skus].sort((a, b) => {
    const completeA = a.supplyPriceCny != null && a.referenceWeightG != null;
    const completeB = b.supplyPriceCny != null && b.referenceWeightG != null;
    return Number(completeB) - Number(completeA)
      || (a.supplyPriceCny ?? Infinity) - (b.supplyPriceCny ?? Infinity)
      || (a.referenceWeightG ?? Infinity) - (b.referenceWeightG ?? Infinity)
      || compareIds(a.id, b.id);
  });
  return sorted[0] ?? null;
}

function groupFor(product, playbooks) {
  const groups = playbooks?.groups || [];
  return groups.find((group) => group.productIds?.map(String).includes(String(product.id)))
    || groups.find((group) => group.sourceCategories?.includes(product.category?.name))
    || { id: `source-${product.category?.id || encodeURIComponent(product.category?.name || 'unclassified')}`, name: product.category?.name || '未分类商品', workflowFit: null, operationalEase: null, thesis: '新类目已自动纳入覆盖，等待补运营判断。', risks: ['该类目尚未有针对性的运营判断'], checks: ['补充用途、印花流程和质量验证清单'], fallback: true };
}

function evaluateProduct(product, playbook, weights, divisor) {
  const skus = (Array.isArray(product.skus) ? product.skus : []).map((sku) => normalizeRankingSku(sku, divisor)).sort((a, b) => compareIds(a.id, b.id));
  const selectedSku = selectSku(skus);
  const advertisedDelivery = String(product.delivery?.text || '');
  const deliveryMatch = advertisedDelivery.match(/(\d+)\s*小时/);
  const deliveryHours = deliveryMatch ? Number(deliveryMatch[1]) : null;
  const hasPrint = PRINT.test(product.craft || '') || product.customizable === true;
  const workflowPrior = numberOrNull(playbook.workflowFit);
  const operationPrior = numberOrNull(playbook.operationalEase);
  const skuEase = skus.length ? (skus.length <= 2 ? 100 : skus.length <= 4 ? 85 : skus.length <= 8 ? 65 : skus.length <= 20 ? 40 : 20) : null;
  const components = {
    workflowFit: workflowPrior == null || !product.craft ? null : round(clamp(workflowPrior) * (hasPrint ? 1 : 0.65)),
    costEfficiency: thresholdScore(selectedSku?.supplyPriceCny, [[5, 100], [8, 88], [12, 75], [20, 55], [30, 35], [50, 20]]),
    logistics: thresholdScore(selectedSku?.referenceWeightG, [[100, 100], [200, 90], [350, 78], [500, 65], [800, 50], [1200, 32], [2000, 20]]),
    operations: operationPrior == null || skuEase == null ? null : round(clamp(operationPrior) * 0.8 + skuEase * 0.2),
    fulfillment: deliveryHours == null ? null : thresholdScore(deliveryHours, [[24, 100], [48, 70], [72, 40], [168, 20]]),
  };
  const observedCurrent = !(Number(product.missingRuns) > 0);
  if (!observedCurrent) for (const key of KEYS) components[key] = null;
  const coverageSignals = {
    skuPrice: selectedSku?.supplyPriceCny != null,
    skuWeight: selectedSku?.weightG != null,
    skuDimensions: selectedSku?.referenceWeightG != null,
    craft: Boolean(product.craft),
    source: Boolean(product.sourceUrl),
    delivery: deliveryHours != null,
  };
  const supplyCoveragePct = Math.round(Object.values(coverageSignals).filter(Boolean).length / 6 * 100);
  const isRestricted = RESTRICTED.test(`${product.title || ''} ${product.category?.name || ''}`);
  const risks = [];
  if (!selectedSku) risks.push('缺少可关联的 SKU 报价，商品范围价格不用于计算');
  if (selectedSku?.supplyPriceCny == null) risks.push('该SKU供货报价缺失');
  if (selectedSku?.referenceWeightG == null) risks.push('同SKU重量或三边尺寸缺失，物流维度不计分');
  if (selectedSku?.packUnits == null) risks.push('SKU套数未明确识别，报价按该SKU整包记录，不折算单件');
  if (!hasPrint) risks.push('未从工艺字段确认现有印花能力');
  if (product.missingRuns > 0) risks.push('本轮目录未发现该商品，等待下一轮确认');
  const completeDimensions = KEYS.every((key) => components[key] != null);
  const ready = selectedSku?.supplyPriceCny != null && selectedSku?.referenceWeightG != null && completeDimensions && !playbook.fallback && observedCurrent && Boolean(product.sourceUrl);
  return {
    id: String(product.id), title: String(product.title || ''), sourceUrl: product.sourceUrl || null,
    image: product.images?.[0] || null, sourceCategory: { id: String(product.category?.id || ''), name: product.category?.name || '' },
    selectedSku, skus, selectedSkuPolicy: '最便宜的完整SKU；价格、实重、尺寸始终对应同一SKU。无完整SKU则只展示已有字段。',
    priceRangeCny: range(skus.map((sku) => sku.supplyPriceCny)), weightRangeG: range(skus.map((sku) => sku.referenceWeightG)),
    skuCount: skus.length, delivery: advertisedDelivery, craft: product.craft || null, material: product.material || null,
    score: completeDimensions && observedCurrent && product.sourceUrl ? weightedScore(components, weights) : null, components, supplyCoveragePct: observedCurrent ? supplyCoveragePct : 0, coverageSignals, observedCurrent,
    status: isRestricted || playbook.gate === 'review' ? 'review' : !ready ? 'needs_data' : playbook.isControl ? 'control' : 'candidate',
    reasons: [selectedSku?.supplyPriceCny != null ? `同SKU供货价 ¥${selectedSku.supplyPriceCny}` : null, selectedSku?.referenceWeightG != null ? `同SKU物流参考重 ${selectedSku.referenceWeightG}g` : null, advertisedDelivery ? `源站承诺${advertisedDelivery}` : null].filter(Boolean),
    risks,
  };
}

function aggregateCategory(group, products, weights) {
  const scoredProducts = products.filter((p) => p.score != null && p.status !== 'needs_data');
  const components = Object.fromEntries(KEYS.map((key) => [key, median(scoredProducts.map((p) => p.components[key]))]));
  const supplyCoveragePct = round(products.reduce((total, p) => total + p.supplyCoveragePct, 0) / products.length);
  const actionable = products.filter((p) => ['candidate', 'control'].includes(p.status));
  const status = group.gate === 'review' || products.some((p) => p.status === 'review') ? 'review'
    : !actionable.length || products.filter((p) => p.status === 'needs_data').length > products.length / 2 ? 'needs_data'
      : group.isControl ? 'control' : 'candidate';
  const score = weightedScore(components, weights);
  const dimensions = Object.fromEntries(KEYS.map((key) => [key, {
    score: components[key], weight: weights[key], knownCount: products.filter((p) => p.components[key] != null).length,
    totalCount: products.length, scoredProductCount: scoredProducts.length,
    basis: ['workflowFit', 'operations'].includes(key) ? '运营先验 + 目录字段；逐商品得分的中位数' : '逐商品选定SKU/发货字段的得分中位数',
  }]));
  const currentProducts = products.filter((p) => p.observedCurrent);
  const allSkus = currentProducts.flatMap((p) => p.skus);
  const sourceCategories = [...new Map(products.map((p) => [p.sourceCategory.id || p.sourceCategory.name, p.sourceCategory])).values()].sort((a, b) => compareIds(a.id, b.id));
  const selectedPrice = range(currentProducts.map((p) => p.selectedSku?.supplyPriceCny));
  const selectedWeight = range(currentProducts.map((p) => p.selectedSku?.referenceWeightG));
  const reasons = [group.thesis];
  if (selectedPrice.median != null) reasons.push(`各商品入门SKU供货价中位数 ¥${selectedPrice.median}（不含运费/包装/售后）`);
  if (selectedWeight.median != null) reasons.push(`各商品同SKU物流参考重中位数 ${selectedWeight.median}g`);
  const risks = unique([
    ...(group.risks || []),
    products.length === 1 ? '当前只有1款供应商品；不能代表整个市场或供应商多样性' : `覆盖当前来源 ${products.length} 款，均来自同一目录，供应商独立性未核验`,
    '需求、竞争、真实核价与利润证据未齐，不作为销量或盈利预测',
    products.some((p) => p.status === 'needs_data') ? '存在报价或物流字段缺失商品，相关维度仅统计已知值' : null,
  ]);
  const priorityProducts = [...products].sort((a, b) => {
    const order = { candidate: 0, control: 0, needs_data: 1, review: 2 };
    return order[a.status] - order[b.status] || (b.score ?? -1) - (a.score ?? -1)
      || (a.selectedSku?.supplyPriceCny ?? Infinity) - (b.selectedSku?.supplyPriceCny ?? Infinity)
      || (a.selectedSku?.referenceWeightG ?? Infinity) - (b.selectedSku?.referenceWeightG ?? Infinity)
      || compareIds(a.id, b.id);
  });
  return {
    id: group.id, name: group.name, rank: null, score, status, productCount: products.length, sourceCategories,
    productIds: products.map((p) => p.id).sort(compareIds), isControl: Boolean(group.isControl),
    confidence: { supplyCoveragePct, marketCoveragePct: 0, label: '供应资料覆盖率；市场证据未验证', sampleSize: products.length },
    dimensions, reasons: reasons.filter(Boolean), risks,
    nextSteps: unique([...(group.checks || []), '确认报价是否包含印刷、包装与履约，按真实SKU记录完整成本', '完成小样质量检查后，用小额订单记录曝光、订单、退货和贡献毛利']),
    recommendedProducts: priorityProducts.slice(0, 3), products: priorityProducts,
    stats: { supplyPriceCny: range(allSkus.map((sku) => sku.supplyPriceCny)), referenceWeightG: range(allSkus.map((sku) => sku.referenceWeightG)), entrySupplyPriceCny: selectedPrice, entryReferenceWeightG: selectedWeight, skuCount: allSkus.length, validQuoteSkuCount: allSkus.filter((sku) => sku.supplyPriceCny != null && sku.referenceWeightG != null).length },
    marketEvidence: { demand: null, competition: null, margin: null, status: 'unverified' },
    caveats: ['排名比较入门SKU供给适配；全SKU范围用于查看跨度，不是销量加权平均。', '来源为同一供应目录；款数不是供应商数。', '运营判断分值是可调整先验，没有历史收益校准。'],
    playbook: { provenance: 'operator_hypothesis', workflowFit: group.workflowFit ?? null, operationalEase: group.operationalEase ?? null, fallback: Boolean(group.fallback) },
  };
}

export function buildCategoryRankings(catalog = {}, options = {}) {
  const playbooks = options.playbooks || { version: 1, groups: [] };
  const selected = RANKING_STRATEGIES.find((s) => s.id === options.strategy) || RANKING_STRATEGIES[0];
  const weights = normalizeWeights(options.weights || selected.weights);
  const divisor = positive(options.volumetricDivisor) || 5000;
  const inputProducts = Array.isArray(catalog.products) ? catalog.products : [];
  const active = inputProducts.filter((p) => p.active !== false).sort((a, b) => compareIds(a.id, b.id));
  const groups = new Map();
  for (const product of active) {
    const group = groupFor(product, playbooks);
    if (!groups.has(group.id)) groups.set(group.id, { group, products: [] });
    groups.get(group.id).products.push(evaluateProduct(product, group, weights, divisor));
  }
  const categories = [...groups.values()].map(({ group, products }) => aggregateCategory(group, products, weights));
  const statusOrder = { candidate: 0, control: 1, review: 2, needs_data: 3 };
  categories.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (b.score ?? -1) - (a.score ?? -1) || compareIds(a.id, b.id));
  let rank = 0;
  for (const category of categories) if (category.status === 'candidate') category.rank = ++rank;
  const counts = Object.fromEntries(Object.keys(statusOrder).map((status) => [status, categories.filter((c) => c.status === status).length]));
  const previous = options.previousReport;
  const comparable = Boolean(previous && previous.schemaVersion === RANKING_VERSION && previous.selectedStrategy === selected.id
    && JSON.stringify(previous.weights) === JSON.stringify(weights) && JSON.stringify(previous.playbooks) === JSON.stringify(playbooks));
  const previousCategories = new Map((comparable ? previous.categories : []).map((c) => [c.id, c]));
  const rankChanges = { movedUp: 0, movedDown: 0, newCategories: 0, unchanged: 0, leftCandidates: 0 };
  for (const category of categories) {
    const prior = previousCategories.get(category.id);
    const bothRanked = category.rank != null && prior?.rank != null;
    category.previousRank = prior?.rank ?? null;
    category.rankChange = bothRanked ? prior.rank - category.rank : null;
    category.previousScore = prior?.score ?? null;
    category.scoreChange = category.score != null && prior?.score != null ? round(category.score - prior.score) : null;
    category.movement = !comparable ? 'baseline' : !prior ? 'new' : !bothRanked ? (prior.rank != null ? 'left_candidates' : category.rank != null ? 'entered_candidates' : 'not_ranked') : category.rankChange > 0 ? 'up' : category.rankChange < 0 ? 'down' : 'unchanged';
    if (category.movement === 'up') rankChanges.movedUp += 1;
    if (category.movement === 'down') rankChanges.movedDown += 1;
    if (category.movement === 'new') rankChanges.newCategories += 1;
    if (category.movement === 'unchanged') rankChanges.unchanged += 1;
    if (category.movement === 'left_candidates') rankChanges.leftCandidates += 1;
  }
  return {
    schemaVersion: RANKING_VERSION,
    generatedAt: options.generatedAt || catalog.generatedAt || null,
    catalogGeneratedAt: catalog.generatedAt || null,
    catalogObservedAt: options.catalogObservedAt || null,
    catalogHash: catalog.catalogHash || null,
    scope: { title: '现有供应目录的品类初测优先级', market: '目标市场：Temu 美国站；排名未计入未经核实的市场销量', source: catalog.source || null, sourceProductCount: catalog.sourceTotal ?? inputProducts.length, activeProductCount: active.length, currentObservedProductCount: active.filter((p) => !(Number(p.missingRuns) > 0)).length, awaitingPresenceReviewCount: active.filter((p) => Number(p.missingRuns) > 0).length, categoryCount: categories.length, coveredProductCount: categories.reduce((n, c) => n + c.productCount, 0), inactiveExcludedCount: inputProducts.length - active.length, uniqueSourceLeafCount: new Set(active.map((p) => p.category?.id || p.category?.name || 'unknown')).size, purpose: '先决定最值得打样和验证的品类；不是最终销量或利润排名' },
    strategies: RANKING_STRATEGIES, dimensions: RANKING_DIMENSIONS, selectedStrategy: selected.id, weights, playbooks,
    summary: { ...counts, candidateCount: counts.candidate, controlCount: counts.control, reviewCount: counts.review, needsDataCount: counts.needs_data, productCount: active.length, categoryCount: categories.length, marketVerifiedCategoryCount: 0, salesAnalysisReady: false, rankChanges, topCategoryIds: categories.filter((c) => c.status === 'candidate').slice(0, 3).map((c) => c.id) },
    comparison: { available: comparable, previousGeneratedAt: comparable ? previous.generatedAt : null, previousCatalogObservedAt: comparable ? previous.catalogObservedAt : null, previousCatalogHash: comparable ? previous.catalogHash : null, basis: '与严格早于今天（上海时区）的上一有效采集日基线比较；仅模型版本、策略权重和运营判断相同时可比。首日或切换口径不倒算变化。' },
    methodology: {
      version: 'supply-pod-priority-v1', title: '供应与运营适配初测排名',
      formula: '仅以五个维度都有依据且本轮实际出现的商品计算品类维度中位数，再按策略权重求和。缺项商品不生成综合分，缺失不当零。',
      missingPolicy: '缺失值保持 null；缺任一评分维度的商品不计综合分，超过半数商品缺维度或没有完整商品的品类不授予候选名次。',
      selectedSkuPolicy: '每个商品选择最便宜的完整SKU（供货报价、实重、三边）；不得混合不同SKU价格和重量。价格按该SKU整包，不擅自折算单件。',
      rankingBasis: '逐商品入门SKU得分中位数；一款一票，减少大SKU矩阵对品类的机械放大。',
      supplyPricePolicy: '使用 supplyPriceCny，不使用成本底价、历史演示数据或推测核价；供货是否含印刷/包装仍需确认。',
      logisticsPolicy: `同SKU max(实重,长×宽×高/${divisor}×1000)g；分母是场景假设，目录尺寸是否含最终包装未经核验，不是承运商实收重量。`,
      weightDivisor: divisor,
      thresholds: { costEfficiency: [[5, 100], [8, 88], [12, 75], [20, 55], [30, 35], [50, 20], ['above', 10]], logistics: [[100, 100], [200, 90], [350, 78], [500, 65], [800, 50], [1200, 32], [2000, 20], ['above', 10]], operations: '80%品类运营便利先验 + 20% SKU数量便利；SKU≤2/4/8/20/>20分别100/85/65/40/20。' },
      marketPolicy: '市场需求、竞争、销量、利润全为未知，不引用历史legacy演示数据；化妆包THunt冲突与风控显示不计入需求排名。',
      controlPolicy: '抱枕套是现有业务对照，单独展示，不挤占新类目候选排名；不推断目录同款已有订单验证。',
      reviewPolicy: '烟具火源配件、婴幼儿接触、食品接触、承力牵引先补适用证据；是内部流程门槛，不作法规结论。',
      provenance: playbooks.provenance || '未提供品类运营判断；新类目仅展示供应字段',
    },
    categories,
  };
}

export const rankCategories = buildCategoryRankings;
