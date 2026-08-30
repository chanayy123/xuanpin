import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, ChevronRight, ClipboardPlus, Database, Filter, PackageOpen, RefreshCw, Scale, ShieldCheck } from 'lucide-react';

const badgeClass = (status) => ({ 可优先测款: 'badge-emerald', 普通测款: 'badge-cyan', 谨慎评估: 'badge-amber', 合规复核: 'badge-rose' }[status] || 'badge-cyan');
const rootCategory = (product) => product.category.breadcrumbs?.[0]?.name || product.category.name || '未分类';
const primaryRisk = (product) => product.assessment.status === '合规复核'
  ? product.assessment.risks.find((risk) => risk.includes('合规')) || product.assessment.risks[0]
  : product.assessment.risks[0];

export default function SelectionHub({ products, searchQuery, syncMeta, catalog, stale, shortlist, onToggleShortlist, onSelectProduct, onOpenCalc, priorityOnly = false }) {
  const [category, setCategory] = useState('全部类目');
  const [platform, setPlatform] = useState('全部平台');
  const [status, setStatus] = useState('全部状态');
  const [sortBy, setSortBy] = useState('score');
  const [visibleCount, setVisibleCount] = useState(24);
  const categories = useMemo(() => ['全部类目', ...new Set(products.map(rootCategory).filter(Boolean))], [products]);
  const platforms = useMemo(() => ['全部平台', ...new Set(products.flatMap((product) => product.platforms))], [products]);
  const statuses = ['全部状态', '可优先测款', '普通测款', '谨慎评估', '合规复核'];

  useEffect(() => setVisibleCount(24), [category, platform, status, sortBy, searchQuery]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const haystack = [product.id, product.title, product.category.name, rootCategory(product), product.material, product.craft, product.warehouse].join(' ').toLowerCase();
      return (!query || haystack.includes(query))
        && (category === '全部类目' || rootCategory(product) === category)
        && (platform === '全部平台' || product.platforms.includes(platform))
        && (status === '全部状态' || product.assessment.status === status);
    }).sort((a, b) => {
      if (sortBy === 'price') return (a.price.minCny ?? Infinity) - (b.price.minCny ?? Infinity);
      if (sortBy === 'weight') return (a.assessment.chargeableMaxG ?? Infinity) - (b.assessment.chargeableMaxG ?? Infinity);
      if (sortBy === 'new') return Number(b.id) - Number(a.id);
      return b.assessment.score - a.assessment.score || Number(b.id) - Number(a.id);
    });
  }, [products, searchQuery, category, platform, status, sortBy]);

  const priorityCount = catalog.products.filter((product) => product.active && product.assessment.status === '可优先测款').length;
  const reviewCount = catalog.products.filter((product) => product.active && product.assessment.status === '合规复核').length;

  return (
    <div className="selection-page animate-fade-in">
      {stale && <div className="stale-banner"><AlertTriangle size={18} /><div><strong>目录超过 48 小时未成功同步</strong><span>当前数据仅供参考，请先检查自动同步任务。</span></div></div>}
      <section className="workspace-heading">
        <div><span className="eyebrow">{priorityOnly ? '优先测款候选' : '全量真实目录'}</span><h1>{priorityOnly ? '具备较好运营条件的测款候选' : '从真实供货数据出发做选品判断'}</h1><p>评分只使用源站可核验的价格、重量、尺寸、时效、材质与 SKU；市场销量、竞品售价和利润没有可信证据时保持为空。</p></div>
        <a className="source-link" href={catalog.source} target="_blank" rel="noreferrer"><Database size={16} />查看源站目录 <ChevronRight size={15} /></a>
      </section>
      <section className="metric-grid">
        <Metric icon={PackageOpen} label="源站商品" value={syncMeta.sourceTotal} note={`本次取得 ${syncMeta.fetchedRecords} 条`} />
        <Metric icon={ShieldCheck} label="优先测款" value={priorityCount} note="无合规拦截且评分 ≥75" tone="green" />
        <Metric icon={Scale} label="合规复核" value={reviewCount} note="不会进入推荐榜" tone="red" />
        <Metric icon={RefreshCw} label="本次记录变化" value={syncMeta.changeCount} note={`${new Date(syncMeta.lastSuccessAt).toLocaleString('zh-CN', { hour12: false })} · 含规则结果`} tone="blue" />
      </section>
      <section className="filter-bar card-glass">
        <div className="filter-label"><Filter size={16} />筛选</div>
        <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="按类目筛选">{categories.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="按平台筛选">{platforms.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="按评估状态筛选">{statuses.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="商品排序"><option value="score">测款分从高到低</option><option value="price">供货价从低到高</option><option value="weight">计费重量从低到高</option><option value="new">最新商品优先</option></select>
        <span className="result-count">找到 {filtered.length} 款</span>
      </section>
      {filtered.length === 0 ? <div className="empty-state card-glass"><PackageOpen size={36} /><h3>没有符合当前条件的商品</h3><p>请调整筛选条件或搜索关键词。</p></div> : <><section className="product-grid">{filtered.slice(0, visibleCount).map((product) => (
        <article className="product-card card-glass" key={product.id}>
          <button className="image-button" onClick={() => onSelectProduct(product)} aria-label={`查看 ${product.title}`}>
            {product.images[0] ? <img src={product.images[0]} alt={product.title} loading="lazy" /> : <div className="image-placeholder"><PackageOpen size={30} /></div>}
            <span className={`badge ${badgeClass(product.assessment.status)}`}>{product.assessment.status}</span><b className="score-pill">{product.assessment.score}<small>/100</small></b>
          </button>
          <div className="product-body">
            <div className="product-meta"><span>#{product.id}</span><span>{rootCategory(product)}</span><span>{product.delivery.text || '时效未知'}</span></div>
            <button className="product-title" onClick={() => onSelectProduct(product)}>{product.title}</button>
            <div className="facts-row"><div><small>最低供货价</small><strong>{product.price.minCny == null ? '—' : `¥${product.price.minCny}`}</strong></div><div><small>计费重量</small><strong>{product.assessment.chargeableMaxG == null ? '—' : `${product.assessment.chargeableMaxG}g`}</strong></div><div><small>证据完整度</small><strong>{product.assessment.confidence}%</strong></div></div>
            <div className="reason-block"><strong>推荐依据</strong><p>{product.assessment.reasons[0] || '暂未形成明确加分依据'}</p></div>
            <div className={`risk-line ${product.assessment.risks.length ? '' : 'safe'}`}><AlertTriangle size={14} />{primaryRisk(product) || '未发现明显运营风险'}</div>
            <div className="product-actions"><button className={shortlist[product.id] ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onToggleShortlist(product)}><ClipboardPlus size={15} />{shortlist[product.id] ? '已加入清单' : '加入测款清单'}</button><button className="btn btn-outline" onClick={() => onOpenCalc(product)}><Calculator size={15} />测算</button></div>
          </div>
        </article>
      ))}</section>{visibleCount < filtered.length && <button className="btn btn-secondary load-more" onClick={() => setVisibleCount((count) => count + 24)}>继续显示（还剩 {filtered.length - visibleCount} 款）</button>}</>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, note, tone = '' }) {
  return <div className={`metric-card card-glass ${tone}`}><Icon size={20} /><div><small>{label}</small><strong>{value}</strong><span>{note}</span></div></div>;
}
