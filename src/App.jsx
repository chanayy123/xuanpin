import React, { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SelectionHub from './components/SelectionHub';
import GoodsDetailModal from './components/GoodsDetailModal';
import AiSelectionModal from './components/AiSelectionModal';
import ProfitCalculatorModal from './components/ProfitCalculatorModal';
import FavoritesView from './components/FavoritesView';

const SHORTLIST_KEY = 'xuanpin-shortlist-v1';

function loadShortlist() {
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [syncMeta, setSyncMeta] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('catalog');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [shortlist, setShortlist] = useState(loadShortlist);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [calcProduct, setCalcProduct] = useState(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    Promise.all([
      fetch(`${base}data/catalog.json`, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`商品目录读取失败（HTTP ${response.status}）`);
        return response.json();
      }),
      fetch(`${base}data/sync-meta.json`, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`同步状态读取失败（HTTP ${response.status}）`);
        return response.json();
      }),
    ]).then(([catalogData, metaData]) => {
      setCatalog(catalogData);
      setSyncMeta(metaData);
    }).catch((error) => setLoadError(error.message));
  }, []);

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(shortlist));
  }, [shortlist]);

  const products = catalog?.products || [];
  const activeProducts = products.filter((product) => product.active);
  const shortlistProducts = useMemo(
    () => products.filter((product) => shortlist[product.id]),
    [products, shortlist],
  );

  const toggleShortlist = (product) => {
    setShortlist((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { addedAt: new Date().toISOString(), note: '' };
      return next;
    });
  };

  const updateShortlistNote = (productId, note) => {
    setShortlist((current) => ({ ...current, [productId]: { ...current[productId], note } }));
  };

  const openCalculator = (product = null) => {
    setCalcProduct(product);
    setIsCalcOpen(true);
  };

  if (loadError) {
    return (
      <div className="state-page">
        <div className="card-glass state-card">
          <span className="badge badge-rose">数据加载失败</span>
          <h1>无法读取规范化商品目录</h1>
          <p>{loadError}</p>
          <code>请先运行 npm run sync 生成 public/data 下的数据。</code>
        </div>
      </div>
    );
  }

  if (!catalog || !syncMeta) return <div className="state-page"><div className="loading-dot" />正在读取真实商品目录…</div>;

  const stale = Date.now() - new Date(syncMeta.lastSuccessAt).getTime() > 48 * 60 * 60 * 1000;

  return (
    <div className="app-container">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        openMethod={() => setIsMethodOpen(true)}
        openCalc={() => openCalculator()}
        shortlistCount={shortlistProducts.length}
        setActiveTab={setActiveTab}
        syncMeta={syncMeta}
        stale={stale}
      />
      <div className="main-body">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          shortlistCount={shortlistProducts.length}
          syncMeta={syncMeta}
          stale={stale}
          openMethod={() => setIsMethodOpen(true)}
          openCalc={() => openCalculator()}
        />
        <main className="content-area">
          {activeTab === 'catalog' && (
            <SelectionHub
              products={activeProducts}
              searchQuery={searchQuery}
              syncMeta={syncMeta}
              catalog={catalog}
              stale={stale}
              shortlist={shortlist}
              onToggleShortlist={toggleShortlist}
              onSelectProduct={setSelectedProduct}
              onOpenCalc={openCalculator}
            />
          )}
          {activeTab === 'priority' && (
            <SelectionHub
              products={activeProducts.filter((product) => product.assessment.status === '可优先测款')}
              searchQuery={searchQuery}
              syncMeta={syncMeta}
              catalog={catalog}
              stale={stale}
              shortlist={shortlist}
              onToggleShortlist={toggleShortlist}
              onSelectProduct={setSelectedProduct}
              onOpenCalc={openCalculator}
              priorityOnly
            />
          )}
          {activeTab === 'shortlist' && (
            <FavoritesView
              products={shortlistProducts}
              entries={shortlist}
              onToggleShortlist={toggleShortlist}
              onUpdateNote={updateShortlistNote}
              onSelectProduct={setSelectedProduct}
              onOpenCalc={openCalculator}
            />
          )}
        </main>
      </div>
      <GoodsDetailModal
        product={selectedProduct}
        shortlisted={selectedProduct ? Boolean(shortlist[selectedProduct.id]) : false}
        onClose={() => setSelectedProduct(null)}
        onToggleShortlist={toggleShortlist}
        onOpenCalc={openCalculator}
      />
      <AiSelectionModal isOpen={isMethodOpen} onClose={() => setIsMethodOpen(false)} />
      <ProfitCalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} initialProduct={calcProduct} />
    </div>
  );
}
