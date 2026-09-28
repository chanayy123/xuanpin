import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCategoryRankings } from './lib/category-ranking.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const escapeCsv = (value) => {
  const raw = String(value ?? '');
  const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]|^[\u0000-\u001f]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
const escapeMd = (value) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');

export function shanghaiDate(timestamp) {
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? new Date(value + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
}

export function updateRankingHistory(history, report, validObservation = true) {
  const date = shanghaiDate(report.generatedAt);
  const snapshots = (Array.isArray(history?.snapshots) ? history.snapshots : []).filter((s) => !validObservation || s.date !== date);
  if (validObservation && date) snapshots.push({
    date, schemaVersion: report.schemaVersion, generatedAt: report.generatedAt, catalogObservedAt: report.catalogObservedAt,
    catalogHash: report.catalogHash, selectedStrategy: report.selectedStrategy, weights: report.weights, playbooks: report.playbooks,
    categories: report.categories.map(({ id, rank, score, status }) => ({ id, rank, score, status })),
  });
  const cutoff = new Date(Date.parse(report.generatedAt) - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { schemaVersion: 1, timezone: 'Asia/Shanghai', retentionDays: 180, snapshots: snapshots.filter((s) => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date)).slice(-180) };
}

export function rankingCsv(report) {
  const headers = ['候选排名', '品类', '状态', '初测适配分', '供应商品数', '供应字段覆盖率', '入门SKU供货价中位数CNY', '入门SKU物流参考重中位数g', '全部SKU最低报价CNY', '全部SKU最高报价CNY', '推荐商品ID', '理由', '待验证', '市场销量已验证', '上次排名', '名次提升', '变化类型'];
  const rows = report.categories.map((c) => [c.rank, c.name, c.status, c.score, c.productCount, c.confidence.supplyCoveragePct, c.stats.entrySupplyPriceCny.median, c.stats.entryReferenceWeightG.median, c.stats.supplyPriceCny.min, c.stats.supplyPriceCny.max, c.recommendedProducts.map((p) => p.id).join(';'), c.reasons.join('；'), c.risks.join('；'), '否', c.previousRank, c.rankChange, c.movement]);
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n') + '\n';
}

export function rankingMarkdown(report) {
  const lines = ['# 内部品类初测排名', '', `目录最近成功采集：${report.catalogObservedAt || '未提供'}。目录内容生成时间：${report.catalogGeneratedAt}。排名生成时间：${report.generatedAt}。`, '', `覆盖 ${report.scope.activeProductCount} 款有效商品、${report.scope.uniqueSourceLeafCount} 个源站叶类目，按用途整理为 ${report.scope.categoryCount} 个运营品类。候选 ${report.summary.candidateCount} 类、现有对照 ${report.summary.controlCount} 类、待专项复核 ${report.summary.reviewCount} 类、待补资料 ${report.summary.needsDataCount} 类。`, '', '**用途：决定先打样、先验证什么。当前没有跨品类可比的销量、竞争或真实利润证据，不能将本榜解释为最好卖或利润最高。**', '', report.comparison.available ? `相较上次发布：上升 ${report.summary.rankChanges.movedUp} 类，下降 ${report.summary.rankChanges.movedDown} 类，新增 ${report.summary.rankChanges.newCategories} 类。比较基准时间：${report.comparison.previousGeneratedAt}。` : '当前为首个可比基线，尚无可比较的排名变化。', '', '## 候选排名', '', '| 名次 | 品类 | 初测适配分 | 商品数 | 入门SKU报价中位数 | 同SKU物流参考重中位数 | 第一推荐商品 |', '| ---: | --- | ---: | ---: | ---: | ---: | --- |'];
  for (const c of report.categories.filter((c) => c.status === 'candidate')) lines.push(`| ${c.rank} | ${escapeMd(c.name)} | ${c.score} | ${c.productCount} | ¥${c.stats.entrySupplyPriceCny.median ?? '—'} | ${c.stats.entryReferenceWeightG.median ?? '—'}g | ${escapeMd(c.recommendedProducts[0]?.title)} |`);
  for (const c of report.categories) {
    lines.push('', `## ${c.rank ? `${c.rank}. ` : ''}${c.name} · ${c.status}`, '', ...c.reasons.map((s) => `- ${s}`), '', `字段覆盖：${c.confidence.supplyCoveragePct}%；市场证据覆盖：未验证。来源叶类目：${c.sourceCategories.map((s) => s.name).join('、')}。`, '', '待验证：', '', ...c.risks.map((s) => `- ${s}`), '', '下一步：', '', ...c.nextSteps.map((s) => `- ${s}`), '', '可复核的同SKU报价：', '');
    for (const p of c.recommendedProducts) lines.push(`- [${p.title}](${p.sourceUrl})（商品 ${p.id} / SKU ${p.selectedSku?.id || '缺失'}）：供货价 ¥${p.selectedSku?.supplyPriceCny ?? '未知'}，实重 ${p.selectedSku?.weightG ?? '未知'}g，物流参考重 ${p.selectedSku?.referenceWeightG ?? '未知'}g；${p.selectedSku?.specLabel || '规格未提供'}。`);
  }
  lines.push('', '## 可复现口径', '', ...Object.entries(report.methodology).filter(([, value]) => typeof value === 'string').map(([key, value]) => `- ${key}：${value}`), '', '默认权重：', '', ...report.dimensions.map((d) => `- ${d.name}：${report.weights[d.id]}%；${d.description}`), '');
  return lines.join('\n');
}

export function buildRankingFiles({ rootDir = ROOT, generatedAt = new Date().toISOString() } = {}) {
  const catalog = JSON.parse(fs.readFileSync(path.join(rootDir, 'public/data/catalog.json'), 'utf8'));
  const playbooks = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/category-playbooks.json'), 'utf8'));
  const directory = path.join(rootDir, 'public/data');
  const historyPath = path.join(directory, 'ranking-history.json');
  const metaPath = path.join(directory, 'sync-meta.json');
  const history = fs.existsSync(historyPath) ? JSON.parse(fs.readFileSync(historyPath, 'utf8')) : { snapshots: [] };
  const today = shanghaiDate(generatedAt);
  const previousReport = [...(history.snapshots || [])].filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
  const syncMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : null;
  const report = buildCategoryRankings(catalog, { playbooks, previousReport, catalogObservedAt: syncMeta?.lastSuccessAt || null, generatedAt });
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'category-rankings.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(directory, 'category-rankings.csv'), rankingCsv(report));
  fs.writeFileSync(path.join(directory, 'category-rankings.md'), rankingMarkdown(report));
  const validObservation = syncMeta?.status === 'success' && shanghaiDate(syncMeta.lastSuccessAt) === today;
  if (validObservation) fs.writeFileSync(historyPath, JSON.stringify(updateRankingHistory(history, report), null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = buildRankingFiles();
  console.log(JSON.stringify({ generatedAt: report.generatedAt, scope: report.scope, summary: report.summary }));
}
