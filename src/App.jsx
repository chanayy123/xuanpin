import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import Header from './components/Header';
import Sidebar, { navigation } from './components/Sidebar';
import SelectionHub from './components/SelectionHub';
import GoodsDetailModal from './components/GoodsDetailModal';
import ProfitCalculatorModal from './components/ProfitCalculatorModal';
import FavoritesView from './components/FavoritesView';
import CategoryDashboard, { CategoryComparison } from './components/CategoryDashboard';
import EvidenceView from './components/EvidenceView';
import { buildCategoryRankings } from '../scripts/lib/category-ranking.js';

const SHORTLIST_KEY = 'xuanpin-shortlist-v1';
const initialShortlist = () => { try { const value = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } };
const resourceFiles = { catalog: 'catalog', syncMeta: 'sync-meta', ranking: 'category-rankings', dailySync: 'daily-sync', marketEvidence: 'market-evidence' };

export default function App() {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [refreshing, setRefreshing] = useState(true);
  const [activeTab, setActiveTab] = useState('ranking');
  const [strategy, setStrategy] = useState('pod');
  const [searchQuery, setSearchQuery] = useState('');
  const [shortlist, setShortlist] = useState(initialShortlist);
  const [storageError, setStorageError] = useState('');
  const [catalogScope, setCatalogScope] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [calcProduct, setCalcProduct] = useState(null);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState(null);
  const [newBuildAvailable, setNewBuildAvailable] = useState(false);
  const buildVersionRef = useRef(null);
  const dataRef = useRef({});

  const loadData = useCallback(async () => {
    setRefreshing(true);
    const base = import.meta.env.BASE_URL || '/';
    const entries = Object.entries(resourceFiles);
    const readResources = () => Promise.allSettled(entries.map(async ([, file]) => {
      const response = await fetch(`${base}data/${file}.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = await response.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('数据文件结构无效');
      if (file === 'catalog' && !Array.isArray(parsed.products)) throw new Error('商品目录缺少有效的 products 数据');
      if (file === 'category-rankings' && !['categories', 'strategies', 'dimensions'].every((key) => Array.isArray(parsed[key]))) throw new Error('品类排名结构不完整');
      return parsed;
    }));
    let results = await readResources();
    const differentVersions = (responses) => {
      const catalog = responses[0].status === 'fulfilled' ? responses[0].value : dataRef.current.catalog;
      const report = responses[2].status === 'fulfilled' ? responses[2].value : dataRef.current.ranking;
      return catalog?.catalogHash && report?.catalogHash && catalog.catalogHash !== report.catalogHash;
    };
    if (differentVersions(results)) results = await readResources();
    const next = {}, failures = {};
    results.forEach((result, index) => { const key = entries[index][0]; if (result.status === 'fulfilled') next[key] = result.value; else failures[key] = result.reason?.message || '读取失败'; });
    if (differentVersions(results)) {
      delete next.catalog; delete next.ranking; delete next.syncMeta;
      failures.snapshot = '目录和排名版本暂未一致，已保留上一份完整快照，请稍后刷新。';
    }
    const updated = { ...dataRef.current, ...next }; dataRef.current = updated; setData(updated); setErrors(failures); setRefreshing(false);
  }, []);
  useEffect(() => { loadData(); document.body.classList.remove('dark'); document.body.classList.add('light'); }, [loadData]);
  useEffect(() => { try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist)); setStorageError(''); } catch { setStorageError('浏览器本地存储不可用，当前清单只保留在本次页面中，请及时导出。'); } }, [shortlist]);
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape') { setSelectedProduct(null); setIsCalcOpen(false); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => { document.body.style.overflow = selectedProduct || isCalcOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [selectedProduct, isCalcOpen]);
  useEffect(() => {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return undefined;
    const timer = setInterval(async () => { try {
      const response = await fetch('/__dashboard/status.json', { cache: 'no-store' });
      if (!response.ok) return;
      const status = await response.json(); setServerStatus(status);
      if (status.buildVersion && status.buildVersion !== buildVersionRef.current) {
        if (buildVersionRef.current) setNewBuildAvailable(true);
        buildVersionRef.current = status.buildVersion;
        await loadData();
      }
    } catch { /* Optional local update service. */ } }, 60000);
    return () => clearInterval(timer);
  }, [loadData]);

  const products = data.catalog?.products || [];
  const ranking = useMemo(() => {
    if (!data.ranking) return null;
    if (!data.catalog || !data.ranking.playbooks) return data.ranking;
    if (strategy === data.ranking.selectedStrategy) return data.ranking;
    return buildCategoryRankings(data.catalog, { playbooks: data.ranking.playbooks, strategy, generatedAt: data.ranking.generatedAt, catalogObservedAt: data.ranking.catalogObservedAt });
  }, [data.catalog, data.ranking, strategy]);
  const shortlistProducts = useMemo(() => products.filter((product) => shortlist[product.id]), [products, shortlist]);
  const navigate = (tab) => { setActiveTab(tab); setSearchQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleShortlist = (product) => setShortlist((current) => { const next = { ...current }; if (next[product.id]) delete next[product.id]; else next[product.id] = { addedAt: new Date().toISOString(), note: '', stage: '待设计' }; return next; });
  const updateShortlist = (id, patch) => setShortlist((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  const openCalculator = (product = null) => { setCalcProduct(product); setIsCalcOpen(true); };
  const openCatalog = (category) => { setCatalogScope(category); navigate('catalog'); };
  const stale = !data.syncMeta?.lastSuccessAt || Date.now() - new Date(data.syncMeta.lastSuccessAt).getTime() > 48 * 60 * 60 * 1000;
  const syncFailed = data.dailySync?.status === 'failed' || data.syncMeta?.status === 'failed';
  const filteredCatalog = products.filter((product) => product.active && (!catalogScope || catalogScope.productIds?.includes(String(product.id))));

  if (!data.catalog && refreshing) return <div className="state-page"><div className="loading-dot" /><p>正在准备你的选品工作台…</p></div>;
  if (!data.catalog) return <div className="state-page"><div className="card-glass state-card"><AlertTriangle size={30} /><h1>商品资料暂时无法读取</h1><p>站点尚未取得有效目录。{errors.catalog && `读取结果：${errors.catalog}`}</p><button className="btn btn-primary" onClick={loadData}><RefreshCw size={16} />重新读取数据</button></div></div>;

  return <div className="app-container"><Header searchQuery={searchQuery} setSearchQuery={(value) => { if (!['ranking', 'catalog'].includes(activeTab)) setActiveTab('ranking'); setSearchQuery(value); }} shortlistCount={shortlistProducts.length} setActiveTab={navigate} stale={stale} syncFailed={syncFailed} onRefresh={loadData} refreshing={refreshing} activeTab={activeTab} /><div className="main-body"><Sidebar activeTab={activeTab} setActiveTab={navigate} shortlistCount={shortlistProducts.length} syncMeta={data.syncMeta} stale={stale || syncFailed} openCalc={() => openCalculator()} /><main className="content-area">
    <nav className="mobile-nav" aria-label="移动端导航">{navigation.map(({ id, name, icon: Icon }) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={16} />{name}</button>)}</nav>
    {storageError && <div className="load-warning"><AlertTriangle size={16} />{storageError}</div>}
    {syncFailed && <button className="load-warning load-warning-link" onClick={() => navigate('evidence')}><AlertTriangle size={16} />最近一次同步失败。当前显示最近成功快照，查看失败原因与执行记录 →</button>}
    {newBuildAvailable && <div className="inline-feedback" role="status"><RefreshCw size={16} />已读取新发布的数据。刷新应用可载入最新界面与规则，清单仍保存在本机。<button className="text-button" onClick={() => window.location.reload()}>刷新应用</button></div>}
    {Object.keys(errors).length > 0 && activeTab !== 'evidence' && <button className="load-warning load-warning-link" onClick={() => navigate('evidence')}><AlertTriangle size={16} />部分资料读取失败，已保留可用快照。查看数据状态 →</button>}
    {(activeTab === 'ranking' || activeTab === 'compare') && !ranking && <div className="empty-state card-glass"><AlertTriangle size={32} /><h3>品类排名资料尚未就绪</h3><p>可先查看真实供应目录，排名文件恢复后再比较品类。</p><button className="btn btn-secondary" onClick={() => navigate('catalog')}>打开供应商品库</button></div>}
    {activeTab === 'ranking' && ranking && <CategoryDashboard ranking={ranking} strategy={strategy} setStrategy={setStrategy} catalog={data.catalog} searchQuery={searchQuery} shortlist={shortlist} onToggleShortlist={toggleShortlist} onSelectProduct={setSelectedProduct} onOpenCatalog={openCatalog} onCompare={() => navigate('compare')} onEvidence={() => navigate('evidence')} syncMeta={data.syncMeta} stale={stale} />}
    {activeTab === 'compare' && ranking && <CategoryComparison ranking={ranking} strategy={strategy} setStrategy={setStrategy} />}
    {activeTab === 'catalog' && <>{catalogScope && <div className="catalog-scope"><span>当前方向：<strong>{catalogScope.name}</strong> · {filteredCatalog.length} 款</span><button onClick={() => setCatalogScope(null)}><X size={14} />查看全部供应商品</button></div>}<SelectionHub products={filteredCatalog} searchQuery={searchQuery} syncMeta={data.syncMeta || {}} catalog={data.catalog} stale={stale} shortlist={shortlist} onToggleShortlist={toggleShortlist} onSelectProduct={setSelectedProduct} onOpenCalc={openCalculator} /></>}
    {activeTab === 'shortlist' && <FavoritesView products={shortlistProducts} catalogProducts={products} entries={shortlist} onToggleShortlist={toggleShortlist} onUpdateNote={(id, note) => updateShortlist(id, { note })} onUpdateEntry={updateShortlist} onImportEntries={(entries) => setShortlist((current) => ({ ...current, ...entries }))} onSelectProduct={setSelectedProduct} onOpenCalc={openCalculator} onBrowse={() => navigate('ranking')} />}
    {activeTab === 'evidence' && <EvidenceView ranking={ranking} syncMeta={data.syncMeta} dailySync={data.dailySync} marketEvidence={data.marketEvidence} errors={errors} onRefresh={loadData} refreshing={refreshing} serverStatus={serverStatus} />}
    <footer className="workspace-footer"><span>淘金选品 · 内部工作台</span><span>基于事实安排下一次验证</span></footer>
  </main></div><GoodsDetailModal product={selectedProduct} shortlisted={selectedProduct ? Boolean(shortlist[selectedProduct.id]) : false} onClose={() => setSelectedProduct(null)} onToggleShortlist={toggleShortlist} onOpenCalc={openCalculator} /><ProfitCalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} initialProduct={calcProduct} /></div>;
}
