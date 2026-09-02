import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = path.join(ROOT_DIR, 'public', 'data', 'catalog.json');
const JSON_PATH = path.join(ROOT_DIR, 'public', 'data', 'coarse-screen.json');
const MD_PATH = path.join(ROOT_DIR, 'public', 'data', 'coarse-screen.md');
const CSV_PATH = path.join(ROOT_DIR, 'public', 'data', 'coarse-screen.csv');

const DEFAULT_QUOTE_MARKUP_CNY = Number(process.env.DEFAULT_QUOTE_MARKUP_CNY || 4);
const MARKET_DEEP_DIVE_LIMIT = Number(process.env.MARKET_DEEP_DIVE_LIMIT || 20);
const MAX_PER_CATEGORY = Number(process.env.COARSE_SCREEN_MAX_PER_CATEGORY || 2);

const RESTRICTED_PATTERN = /(打火机|烟灰缸|烟盒|烟具)/i;
const FRAGILE_PATTERN = /(陶瓷|玻璃|亚克力|马克杯|镜子|镜框)/i;
const PRINT_CRAFT_PATTERN = /(热转印|热成印|UV|uv|印花|喷绘|丝印|刺绣|烫画|升华)/i;
const HIGH_WORKFLOW_FIT = /(化妆包|束口袋|抽绳包|沙滩包|手提袋|帆布.*包|帆布.*袋|收纳包|枕套|抱枕|桌旗|餐垫|桌布|花园旗|围裙|眼镜布|毛巾|头带|发带|杯垫|鼠标垫|桌垫)/i;
const MEDIUM_WORKFLOW_FIT = /(晴雨伞|雨伞|行李箱套|收纳箱|椅套|沙发套|毯|浴帘|帘垫|地垫|门垫|帽|头巾|电视机罩|冰箱罩)/i;
const EXISTING_CONTROL_PATTERN = /(枕套|抱枕)/i;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function chargeableWeightG(product) {
  const fromAssessment = numberOrNull(product.assessment?.chargeableMaxG);
  if (fromAssessment != null) return fromAssessment;
  const skus = Array.isArray(product.skus) ? product.skus : [];
  const weights = skus.map((sku) => {
    const actual = numberOrNull(sku.weightG) || 0;
    const length = numberOrNull(sku.dimensions?.lengthCm) || 0;
    const width = numberOrNull(sku.dimensions?.widthCm) || 0;
    const height = numberOrNull(sku.dimensions?.heightCm) || 0;
    const volumetric = length && width && height ? (length * width * height / 5000) * 1000 : 0;
    return Math.max(actual, volumetric);
  }).filter((value) => value > 0);
  if (weights.length) return Math.round(Math.max(...weights) * 10) / 10;
  return numberOrNull(product.weight?.maxG);
}

function dataQualityScore(product) {
  let score = 0;
  if (numberOrNull(product.price?.minCny) != null) score += 3;
  if (numberOrNull(product.weight?.maxG) != null) score += 3;
  if ((product.skus || []).some((sku) => sku.dimensions?.lengthCm && sku.dimensions?.widthCm && sku.dimensions?.heightCm)) score += 3;
  if (product.category?.name) score += 2;
  if (product.material || product.craft) score += 2;
  if (product.sourceUrl) score += 1;
  if (product.delivery?.text) score += 1;
  return score;
}

function workflowFitScore(product) {
  const text = `${product.title || ''} ${product.category?.name || ''}`;
  if (HIGH_WORKFLOW_FIT.test(text)) return { score: 25, label: '高' };
  if (MEDIUM_WORKFLOW_FIT.test(text)) return { score: 18, label: '中' };
  if (PRINT_CRAFT_PATTERN.test(product.craft || '')) return { score: 12, label: '一般' };
  return { score: 6, label: '低' };
}

function logisticsScore(weightG) {
  if (weightG == null) return 0;
  if (weightG <= 150) return 20;
  if (weightG <= 300) return 17;
  if (weightG <= 500) return 14;
  if (weightG <= 800) return 10;
  if (weightG <= 1200) return 6;
  if (weightG <= 2000) return 2;
  return 0;
}

function costBarrierScore(factoryFloorPriceCny) {
  if (factoryFloorPriceCny == null) return 0;
  if (factoryFloorPriceCny <= 5) return 20;
  if (factoryFloorPriceCny <= 8) return 17;
  if (factoryFloorPriceCny <= 12) return 14;
  if (factoryFloorPriceCny <= 20) return 10;
  if (factoryFloorPriceCny <= 30) return 5;
  return 0;
}

function fulfillmentScore(text = '') {
  if (/24/.test(text)) return 10;
  if (/48/.test(text)) return 7;
  return text ? 4 : 0;
}

function skuSimplicityScore(count) {
  if (!count) return 0;
  if (count <= 4) return 10;
  if (count <= 8) return 8;
  if (count <= 20) return 5;
  return 2;
}

function evaluate(product) {
  const text = `${product.title || ''} ${product.category?.name || ''} ${product.material || ''}`;
  const factoryFloorPriceCny = numberOrNull(product.price?.minCny);
  const proposedQuoteCny = factoryFloorPriceCny == null
    ? null
    : Number((factoryFloorPriceCny + DEFAULT_QUOTE_MARKUP_CNY).toFixed(2));
  const maxChargeableWeightG = chargeableWeightG(product);
  const workflowFit = workflowFitScore(product);
  const skuCount = Array.isArray(product.skus) ? product.skus.length : 0;

  const components = {
    dataQuality: dataQualityScore(product),
    workflowFit: workflowFit.score,
    logistics: logisticsScore(maxChargeableWeightG),
    costBarrier: costBarrierScore(factoryFloorPriceCny),
    fulfillment: fulfillmentScore(product.delivery?.text || ''),
    skuSimplicity: skuSimplicityScore(skuCount),
  };

  const reasons = [];
  const risks = [];
  let riskDeduction = 0;
  let hardExclude = false;

  if (workflowFit.score === 25) reasons.push('与现有印花/样机工作流高度匹配');
  else if (workflowFit.score === 18) reasons.push('可复用现有印花工作流，但需要额外样机适配');
  else risks.push('与现有布艺印花工作流的复用度较低');

  if (maxChargeableWeightG != null && maxChargeableWeightG <= 300) reasons.push(`计费重量约 ${maxChargeableWeightG}g，轻量`);
  else if (maxChargeableWeightG != null && maxChargeableWeightG > 1200) risks.push(`计费重量约 ${maxChargeableWeightG}g，物流压力较高`);

  if (factoryFloorPriceCny != null && factoryFloorPriceCny <= 8) reasons.push(`厂家最低价 ¥${factoryFloorPriceCny}，试错门槛低`);
  else if (factoryFloorPriceCny != null && factoryFloorPriceCny > 20) risks.push(`厂家最低价 ¥${factoryFloorPriceCny}，首轮测试资金占用较高`);

  if (/24/.test(product.delivery?.text || '')) reasons.push('24小时发货');
  if (skuCount <= 4 && skuCount > 0) reasons.push(`SKU ${skuCount} 个，运营复杂度低`);

  if (RESTRICTED_PATTERN.test(text)) {
    hardExclude = true;
    riskDeduction += 50;
    risks.push('烟具/打火机相关，首轮直接排除，除非单独完成合规验证');
  }
  if (FRAGILE_PATTERN.test(text)) {
    riskDeduction += 8;
    risks.push('易碎/易损材质，包装和售后风险较高');
  }
  if (maxChargeableWeightG != null) {
    if (maxChargeableWeightG > 2000) riskDeduction += 12;
    else if (maxChargeableWeightG > 1200) riskDeduction += 8;
    else if (maxChargeableWeightG > 800) riskDeduction += 4;
  }
  if (factoryFloorPriceCny != null) {
    if (factoryFloorPriceCny > 50) riskDeduction += 15;
    else if (factoryFloorPriceCny > 30) riskDeduction += 10;
    else if (factoryFloorPriceCny > 20) riskDeduction += 5;
  }

  const rawScore = Object.values(components).reduce((sum, value) => sum + value, 0);
  const supplyScreenScore = Math.max(0, Math.min(100, rawScore - riskDeduction));
  const confidenceSignals = [
    factoryFloorPriceCny != null,
    numberOrNull(product.weight?.maxG) != null,
    Boolean(product.category?.name),
    Boolean(product.craft || product.material),
    skuCount > 0,
    Boolean(product.delivery?.text),
    Boolean(product.sourceUrl),
  ];
  const confidence = Math.round(confidenceSignals.filter(Boolean).length / confidenceSignals.length * 100);
  const existingControl = EXISTING_CONTROL_PATTERN.test(`${product.title || ''} ${product.category?.name || ''}`);

  return {
    id: product.id,
    title: product.title,
    category: product.category?.name || '',
    sourceUrl: product.sourceUrl,
    active: product.active !== false,
    factoryFloorPriceCny,
    proposedQuoteCny,
    quoteRule: `factoryFloorPriceCny + ${DEFAULT_QUOTE_MARKUP_CNY} CNY`,
    actualSubmittedQuoteCny: null,
    temuApprovedPriceCny: null,
    maxChargeableWeightG,
    skuCount,
    delivery: product.delivery?.text || '',
    craft: product.craft || '',
    material: product.material || '',
    workflowFit: workflowFit.label,
    components,
    riskDeduction,
    supplyScreenScore,
    confidence,
    hardExclude,
    existingControl,
    reasons,
    risks,
  };
}

function diversify(items, limit, maxPerCategory) {
  const result = [];
  const counts = new Map();
  for (const item of items) {
    if (result.length >= limit) break;
    const key = item.category || item.title;
    const count = counts.get(key) || 0;
    if (count >= maxPerCategory) continue;
    counts.set(key, count + 1);
    result.push(item);
  }
  return result;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(items) {
  const headers = ['排名','商品ID','商品名称','类目','供应端粗筛分','置信度','厂家最低价CNY','暂定申报价CNY','计费重量g','SKU数','发货','工作流适配','已上架对照','推荐理由','风险','源链接'];
  const rows = items.map((item, index) => [
    index + 1,
    item.id,
    item.title,
    item.category,
    item.supplyScreenScore,
    item.confidence,
    item.factoryFloorPriceCny,
    item.proposedQuoteCny,
    item.maxChargeableWeightG,
    item.skuCount,
    item.delivery,
    item.workflowFit,
    item.existingControl ? '是' : '否',
    item.reasons.join(';'),
    item.risks.join(';'),
    item.sourceUrl,
  ].map(csvEscape).join(','));
  return `\uFEFF${headers.map(csvEscape).join(',')}\n${rows.join('\n')}\n`;
}

function toMarkdown(report) {
  const lines = [
    '# 第一轮供应端粗筛',
    '',
    `- 数据生成时间：${report.generatedAt}`,
    `- 当前有效商品：${report.activeCount}`,
    `- 首轮市场深挖候选：${report.marketDeepDiveCandidates.length}`,
    `- 暂定申报价规则：厂家最低价 + ¥${report.settings.defaultQuoteMarkupCny}`,
    `- 同一类目最多进入首轮深挖：${report.settings.maxPerCategory} 款`,
    '',
    '> 这不是最终“最好卖”排名。当前只回答：哪些商品最值得花下一步市场调研额度。需求、竞争、终端价格等市场证据尚未计入。',
    '',
    '## Top 候选',
    '',
    '| 排名 | 商品 | 类目 | 粗筛分 | 底价 | 暂定申报 | 计费重 | 工作流适配 | 备注 |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ];
  report.marketDeepDiveCandidates.forEach((item, index) => {
    const note = item.existingControl ? '已上架对照组' : item.reasons.slice(0, 2).join('；');
    lines.push(`| ${index + 1} | ${item.title} | ${item.category} | ${item.supplyScreenScore} | ¥${item.factoryFloorPriceCny ?? '-'} | ¥${item.proposedQuoteCny ?? '-'} | ${item.maxChargeableWeightG ?? '-'}g | ${item.workflowFit} | ${note} |`);
  });
  lines.push('', '## 首轮直接排除', '');
  const excluded = report.allProducts.filter((item) => item.hardExclude);
  if (!excluded.length) lines.push('- 无');
  else excluded.forEach((item) => lines.push(`- ${item.title}：${item.risks.join('；')}`));
  lines.push('', '## 评分边界', '', '- 供应端粗筛分不包含 Temu 市场需求、竞争度、终端售价、Google/TikTok 趋势。', '- 暂定申报价只用于记录业务链路，不用于推算利润。', '- Top 候选采用类目去重，防止同一类近似商品把 20 个调研名额全部占满。', '');
  return `${lines.join('\n')}\n`;
}

function main() {
  const catalog = readJson(CATALOG_PATH);
  const allProducts = (catalog.products || [])
    .filter((product) => product.active !== false)
    .map(evaluate)
    .sort((a, b) => b.supplyScreenScore - a.supplyScreenScore || b.confidence - a.confidence || Number(b.id) - Number(a.id));

  const eligible = allProducts.filter((item) => !item.hardExclude && item.confidence >= 70);
  const marketDeepDiveCandidates = diversify(eligible, MARKET_DEEP_DIVE_LIMIT, MAX_PER_CATEGORY);
  const candidateIds = new Set(marketDeepDiveCandidates.map((item) => item.id));
  for (const item of allProducts) {
    item.stage1Decision = item.hardExclude
      ? 'exclude'
      : candidateIds.has(item.id)
        ? (item.existingControl ? 'control' : 'advance')
        : 'reserve';
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.generatedAt || null,
    sourceTotal: catalog.sourceTotal ?? null,
    activeCount: allProducts.length,
    settings: {
      defaultQuoteMarkupCny: DEFAULT_QUOTE_MARKUP_CNY,
      marketDeepDiveLimit: MARKET_DEEP_DIVE_LIMIT,
      maxPerCategory: MAX_PER_CATEGORY,
    },
    scoreMeaning: '供应端进入下一轮市场验证的优先级，不代表市场需求或最终盈利能力',
    marketDeepDiveCandidates,
    rawTop20: eligible.slice(0, MARKET_DEEP_DIVE_LIMIT),
    allProducts,
  };

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MD_PATH, toMarkdown(report), 'utf8');
  fs.writeFileSync(CSV_PATH, toCsv(marketDeepDiveCandidates), 'utf8');
  console.log(`粗筛完成：${allProducts.length} 个有效商品，${marketDeepDiveCandidates.length} 个进入市场深挖。`);
}

main();
