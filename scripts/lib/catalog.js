import crypto from 'node:crypto';

export const SCHEMA_VERSION = 1;

const POD_CRAFT_PATTERN = /(热转印|UV|印花|喷绘|丝印|刺绣|激光|雕刻|升华)/i;
const POD_MATERIAL_PATTERN = /(涤纶|聚酯|帆布|亚麻|木|竹|金属|亚克力|陶瓷|TPU|橡胶)/i;
const RESTRICTED_PATTERN = /(打火机|烟灰缸|烟盒|烟具)/i;
const FRAGILE_PATTERN = /(陶瓷|玻璃|亚克力|镜子|镜框)/i;

const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const unique = (values) => [...new Set(values.filter(Boolean))];

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function catalogHash(products) {
  const stableProducts = products.map(({ firstSeenAt, lastChangedAt, ...product }) => product);
  return crypto.createHash('sha256').update(stableStringify(stableProducts)).digest('hex');
}

function chargeableWeightG(sku) {
  const actual = numberOrNull(sku.weightG) || 0;
  const { lengthCm, widthCm, heightCm } = sku.dimensions;
  const volumetric = lengthCm && widthCm && heightCm
    ? (lengthCm * widthCm * heightCm / 5000) * 1000
    : 0;
  return Math.round(Math.max(actual, volumetric) * 10) / 10;
}

export function assessProduct(product) {
  const reasons = [];
  const risks = [];

  let completeness = 0;
  if (product.price.minCny != null) completeness += 3;
  if (product.weight.maxG != null) completeness += 3;
  if (product.skus.some((sku) => sku.dimensions.lengthCm && sku.dimensions.widthCm && sku.dimensions.heightCm)) completeness += 3;
  if (product.category.name) completeness += 2;
  if (product.material || product.craft) completeness += 2;
  if (product.delivery.text) completeness += 1;
  if (product.skus.length > 0) completeness += 1;
  if (completeness !== 15) risks.push(`关键资料完整度 ${completeness}/15`);

  const chargeableMaxG = product.skus.length
    ? Math.max(...product.skus.map(chargeableWeightG))
    : (product.weight.maxG || Infinity);
  let logistics = 0;
  if (chargeableMaxG <= 100) logistics = 20;
  else if (chargeableMaxG <= 250) logistics = 16;
  else if (chargeableMaxG <= 500) logistics = 12;
  else if (chargeableMaxG <= 1000) logistics = 8;
  else if (Number.isFinite(chargeableMaxG)) logistics = 3;
  if (logistics >= 16) reasons.push(`计费重量约 ${chargeableMaxG}g，适合轻量测款`);
  else if (Number.isFinite(chargeableMaxG)) risks.push(`最大计费重量约 ${chargeableMaxG}g，需重点核算物流`);
  else risks.push('缺少可用的物流重量或尺寸');

  const deliveryText = product.delivery.text || '';
  const fulfillment = deliveryText.includes('24') ? 15 : deliveryText.includes('48') ? 10 : deliveryText ? 5 : 0;
  if (fulfillment === 15) reasons.push('24 小时发货');
  else if (fulfillment > 0) risks.push(`${deliveryText}，时效竞争力一般`);

  const price = product.price.minCny;
  let testCost = 0;
  if (price != null && price <= 5) testCost = 15;
  else if (price != null && price <= 10) testCost = 12;
  else if (price != null && price <= 20) testCost = 9;
  else if (price != null && price <= 40) testCost = 5;
  else if (price != null) testCost = 2;
  if (testCost >= 12) reasons.push(`最低供货价 ¥${price}，小批量试错成本较低`);
  else if (price != null) risks.push(`最低供货价 ¥${price}，测试预算相对较高`);

  let differentiation = 0;
  if (product.customizable || POD_CRAFT_PATTERN.test(product.craft || '')) differentiation += 12;
  if (product.skus.length >= 2 && product.skus.length <= 20) differentiation += 4;
  if (POD_MATERIAL_PATTERN.test(`${product.material || ''} ${product.title}`)) differentiation += 4;
  if (differentiation >= 16) reasons.push(`材质/工艺适合图案或规格差异化（${product.craft || product.material}）`);
  else risks.push('源站资料不足以证明明显的差异化能力');

  const restricted = RESTRICTED_PATTERN.test(`${product.title} ${product.category.name}`);
  let compliance = 15;
  if (restricted) {
    compliance = 0;
    risks.push('烟具相关类目，必须先完成人群、平台和运输合规复核');
  } else {
    if (FRAGILE_PATTERN.test(`${product.material || ''} ${product.title}`)) {
      compliance -= 6;
      risks.push('易碎/易损材质，需计入包装和售后损耗');
    }
    if (chargeableMaxG > 1000) {
      compliance -= 7;
      risks.push('大件重量增加退货与履约风险');
    } else if (chargeableMaxG > 500) {
      compliance -= 4;
    }
  }

  const breakdown = { completeness, logistics, fulfillment, testCost, differentiation, compliance };
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const evidenceSignals = [
    price != null,
    product.weight.maxG != null,
    product.skus.length > 0,
    Boolean(product.category.name),
    Boolean(product.material || product.craft),
    Boolean(product.delivery.text),
    Boolean(product.sourceUrl),
  ];
  const confidence = Math.round((evidenceSignals.filter(Boolean).length / evidenceSignals.length) * 100);
  const status = restricted
    ? '合规复核'
    : completeness < 15
      ? '谨慎评估'
      : score >= 75
        ? '可优先测款'
        : score >= 60
          ? '普通测款'
          : '谨慎评估';
  if (completeness === 15) reasons.push('价格、重量、尺寸、类目和 SKU 数据完整');

  return {
    score,
    status,
    confidence,
    breakdown,
    chargeableMaxG: Number.isFinite(chargeableMaxG) ? chargeableMaxG : null,
    reasons,
    risks,
    marketEvidence: null,
    marketPriceUsd: null,
    demandSignal: null,
    competitionSignal: null,
    estimatedMargin: null,
  };
}

export function normalizeProduct(record, detail, previousProduct, observedAt) {
  const source = detail && detail.goodsId ? detail : {};
  const rawSkus = Array.isArray(source.skus) ? source.skus : [];
  const skus = rawSkus.map((sku) => ({
    id: String(sku.id ?? ''),
    supplyPriceCny: numberOrNull(sku.supplyPrice ?? sku.costPrice),
    costPriceCny: numberOrNull(sku.costPrice ?? sku.supplyPrice),
    weightG: numberOrNull(sku.weight),
    dimensions: {
      lengthCm: numberOrNull(sku.length),
      widthCm: numberOrNull(sku.width),
      heightCm: numberOrNull(sku.height),
    },
    specs: (sku.specValues || []).map((spec) => ({ name: spec.specName || '', value: spec.specValue || '' })),
  }));
  const skuPrices = skus.map((sku) => sku.supplyPriceCny).filter((value) => value != null && value > 0);
  const skuWeights = skus.map((sku) => sku.weightG).filter((value) => value != null && value > 0);
  const categoryBreadcrumbs = (source.categoryBreadcrumbs || []).map((item) => ({
    id: String(item.categoryId ?? ''),
    name: item.categoryName || '',
  }));

  const product = {
    id: String(record.goodsId ?? source.goodsId),
    title: record.goodsTitle || source.goodsTitle || '',
    category: {
      id: String(source.categoryId ?? ''),
      name: source.categoryName || record.categoryName || '',
      breadcrumbs: categoryBreadcrumbs,
    },
    platforms: unique(source.platformNames || record.platformNames || []),
    price: {
      minCny: skuPrices.length ? Math.min(...skuPrices) : numberOrNull(record.priceMin),
      maxCny: skuPrices.length ? Math.max(...skuPrices) : numberOrNull(record.priceMax),
      currency: 'CNY',
    },
    weight: {
      minG: skuWeights.length ? Math.min(...skuWeights) : numberOrNull(record.weightMin),
      maxG: skuWeights.length ? Math.max(...skuWeights) : numberOrNull(record.weightMax),
    },
    delivery: {
      code: numberOrNull(source.deliveryTime ?? record.deliveryTime),
      text: source.deliveryTimeText || record.deliveryTimeText || '',
    },
    warehouse: record.selfDeliveryWarehouseText || source.freightNotes?.[0]?.note || '',
    material: source.material || '',
    craft: source.craft || '',
    customizable: Boolean(source.isCustomGoods),
    origin: source.originName || '',
    images: unique([
      record.coverImageUrl,
      ...(source.carousels || []).map((image) => image.imageUrl),
    ]),
    skus,
    sourceUrl: `https://taojinchuhai.cn/merchant/selection/goods/${record.goodsId ?? source.goodsId}`,
    active: true,
    missingRuns: 0,
  };
  product.assessment = assessProduct(product);

  const comparable = ({ firstSeenAt, lastChangedAt, ...value }) => value;
  const unchanged = previousProduct
    && stableStringify(comparable(previousProduct)) === stableStringify(comparable(product));
  product.firstSeenAt = previousProduct?.firstSeenAt || observedAt;
  product.lastChangedAt = unchanged ? previousProduct.lastChangedAt : observedAt;
  return product;
}

export function mergeMissingProducts(currentProducts, previousProducts = []) {
  const currentIds = new Set(currentProducts.map((product) => product.id));
  const missing = previousProducts
    .filter((product) => !currentIds.has(product.id))
    .map((product) => {
      const missingRuns = (product.missingRuns || 0) + 1;
      return {
        ...product,
        missingRuns,
        active: missingRuns < 2,
        assessment: missingRuns < 2
          ? { ...product.assessment, risks: unique([...(product.assessment?.risks || []), '本次同步未发现，等待下一次确认']) }
          : { ...product.assessment, status: '谨慎评估', risks: unique([...(product.assessment?.risks || []), '连续两次同步未发现，已标记下架']) },
      };
    });
  return [...currentProducts, ...missing].sort((a, b) => Number(b.id) - Number(a.id));
}

export function diffCatalog(previousProducts = [], nextProducts = []) {
  const previousMap = new Map(previousProducts.map((product) => [product.id, product]));
  const nextMap = new Map(nextProducts.map((product) => [product.id, product]));
  const changes = [];
  for (const product of nextProducts) {
    const previous = previousMap.get(product.id);
    if (!previous) {
      changes.push({ type: 'added', id: product.id, title: product.title, after: summarizeProduct(product) });
    } else if (stableStringify(previous) !== stableStringify(product)) {
      changes.push({ type: product.active ? 'changed' : 'removed', id: product.id, title: product.title, before: summarizeProduct(previous), after: summarizeProduct(product) });
    }
  }
  for (const product of previousProducts) {
    if (!nextMap.has(product.id)) changes.push({ type: 'missing', id: product.id, title: product.title, before: summarizeProduct(product) });
  }
  return changes;
}

function summarizeProduct(product) {
  return {
    active: product.active,
    priceMinCny: product.price?.minCny ?? null,
    priceMaxCny: product.price?.maxCny ?? null,
    weightMinG: product.weight?.minG ?? null,
    weightMaxG: product.weight?.maxG ?? null,
    score: product.assessment?.score ?? null,
    status: product.assessment?.status ?? null,
  };
}

export function updateHistory(history, changes, observedAt) {
  const cutoff = new Date(observedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - 180);
  const events = Array.isArray(history?.events) ? history.events.filter((event) => new Date(event.observedAt) >= cutoff) : [];
  if (changes.length) events.push({ observedAt, changes });
  return { schemaVersion: SCHEMA_VERSION, retentionDays: 180, events };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function catalogToCsv(catalog) {
  const headers = ['商品ID', '商品名称', '类目', '平台', '最低供货价CNY', '最高供货价CNY', '最小重量g', '最大重量g', '发货时效', '仓库', '材质', '工艺', 'SKU数', '测款分', '状态', '置信度', '推荐依据', '风险', '源链接', '最后变化时间'];
  const rows = catalog.products.map((product) => [
    product.id,
    product.title,
    product.category.name,
    product.platforms.join(';'),
    product.price.minCny,
    product.price.maxCny,
    product.weight.minG,
    product.weight.maxG,
    product.delivery.text,
    product.warehouse,
    product.material,
    product.craft,
    product.skus.length,
    product.assessment.score,
    product.assessment.status,
    product.assessment.confidence,
    product.assessment.reasons.join(';'),
    product.assessment.risks.join(';'),
    product.sourceUrl,
    product.lastChangedAt,
  ].map(csvEscape).join(','));
  return `\uFEFF${headers.map(csvEscape).join(',')}\n${rows.join('\n')}\n`;
}

export function catalogToMarkdown(catalog, syncMeta) {
  const active = catalog.products.filter((product) => product.active);
  const recommended = active.filter((product) => product.assessment.status === '可优先测款');
  const lines = [
    '# 淘金出海商品目录与测款评估',
    '',
    `- 最近成功同步：${syncMeta.lastSuccessAt}`,
    `- 源站商品数：${syncMeta.sourceTotal}`,
    `- 当前有效商品：${active.length}`,
    '- 市场销量/竞争/售价：暂无可复核数据，不参与评分',
    '',
    '## 可优先测款',
    '',
    '| ID | 商品 | 供货价 | 计费重量 | 分数 | 依据 | 风险 |',
    '|---:|---|---:|---:|---:|---|---|',
    ...recommended.map((product) => `| ${product.id} | [${product.title}](${product.sourceUrl}) | ¥${product.price.minCny ?? '—'} | ${product.assessment.chargeableMaxG ?? '—'}g | ${product.assessment.score} | ${product.assessment.reasons.join('；')} | ${product.assessment.risks.join('；') || '—'} |`),
    '',
    '> 本报告仅评估供货、物流、时效、测款成本和差异化条件，不代表市场销量或最终利润。',
    '',
  ];
  return lines.join('\n');
}
