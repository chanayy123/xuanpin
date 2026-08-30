import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SelectionHub from './components/SelectionHub';
import GoodsDetailModal from './components/GoodsDetailModal';
import AiSelectionModal from './components/AiSelectionModal';
import ProfitCalculatorModal from './components/ProfitCalculatorModal';
import ListingWorkbench from './components/ListingWorkbench';
import FavoritesView from './components/FavoritesView';
import { mockProducts } from './data/mockProducts';

export default function App() {
  const [products] = useState(mockProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('selection');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Favorites state
  const [favoriteIds, setFavoriteIds] = useState(['PROD-20260801', 'PROD-20260803']);

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [calcProduct, setCalcProduct] = useState(null);

  // Listing Workbench Tasks State
  const [listingTasks, setListingTasks] = useState([
    {
      taskId: 'TASK-9081',
      product: mockProducts[2],
      store: 'TikTok-US-Shop-01',
      price: 39.99,
      status: '刊登成功',
      timestamp: '2026-08-12 08:15'
    },
    {
      taskId: 'TASK-9082',
      product: mockProducts[0],
      store: 'Amazon-FBA-US',
      price: 29.99,
      status: '刊登成功',
      timestamp: '2026-08-12 08:20'
    }
  ]);

  // Sync dark/light theme class on document body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
  }, [isDarkMode]);

  // Toggle favorite
  const handleToggleFavorite = (productId) => {
    setFavoriteIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Trigger One-Click Listing task
  const handleOneClickList = (product, store = 'TikTok-US-Shop-01', price) => {
    const newTask = {
      taskId: `TASK-${Math.floor(1000 + Math.random() * 9000)}`,
      product: product,
      store: store,
      price: price || product.suggestedRetailUsd,
      status: '刊登成功',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setListingTasks(prev => [newTask, ...prev]);
  };

  // Remove task from listing workbench
  const handleRemoveTask = (taskId) => {
    setListingTasks(prev => prev.filter(t => t.taskId !== taskId));
  };

  // Open Profit Calc with specific product
  const handleOpenCalcForProduct = (prod) => {
    setCalcProduct(prod);
    setIsCalcModalOpen(true);
  };

  // Search filter
  const displayedProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.titleEn.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.factoryLocation.toLowerCase().includes(q) ||
      p.hotTag.toLowerCase().includes(q)
    );
  });

  const favoriteProducts = products.filter(p => favoriteIds.includes(p.id));

  return (
    <div className="app-container">
      {/* Top Header Navigation */}
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        openAiModal={() => setIsAiModalOpen(true)}
        openCalcModal={() => { setCalcProduct(null); setIsCalcModalOpen(true); }}
        favoritesCount={favoriteIds.length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="main-body">
        {/* Left Sidebar Menu */}
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          openAiModal={() => setIsAiModalOpen(true)}
          openCalcModal={() => { setCalcProduct(null); setIsCalcModalOpen(true); }}
          favoritesCount={favoriteIds.length}
          listingCount={listingTasks.length}
        />

        {/* Main Content Workspace Area */}
        <main className="content-area">
          {activeTab === 'selection' && (
            <SelectionHub 
              products={displayedProducts}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onOpenCalc={handleOpenCalcForProduct}
              onToggleFavorite={handleToggleFavorite}
              favoriteIds={favoriteIds}
              onOneClickList={(p) => setSelectedProduct(p)}
            />
          )}

          {activeTab === 'viral' && (
            <SelectionHub 
              products={displayedProducts.filter(p => p.growth7d > 120)}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onOpenCalc={handleOpenCalcForProduct}
              onToggleFavorite={handleToggleFavorite}
              favoriteIds={favoriteIds}
              onOneClickList={(p) => setSelectedProduct(p)}
            />
          )}

          {activeTab === 'factory' && (
            <SelectionHub 
              products={displayedProducts.filter(p => p.deliveryMode === '工厂直发')}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onOpenCalc={handleOpenCalcForProduct}
              onToggleFavorite={handleToggleFavorite}
              favoriteIds={favoriteIds}
              onOneClickList={(p) => setSelectedProduct(p)}
            />
          )}

          {activeTab === 'listing' && (
            <ListingWorkbench 
              listingTasks={listingTasks}
              onRemoveTask={handleRemoveTask}
            />
          )}

          {activeTab === 'favorites' && (
            <FavoritesView 
              favoriteProducts={favoriteProducts}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onToggleFavorite={handleToggleFavorite}
              onOneClickList={(p) => setSelectedProduct(p)}
              onOpenCalc={handleOpenCalcForProduct}
            />
          )}
        </main>
      </div>

      {/* Product Detail Modal */}
      <GoodsDetailModal 
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onOpenCalc={handleOpenCalcForProduct}
        onOneClickList={handleOneClickList}
      />

      {/* AI Smart Selection Generator Modal */}
      <AiSelectionModal 
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onSelectProduct={(p) => setSelectedProduct(p)}
        products={products}
      />

      {/* Profit Calculator Modal */}
      <ProfitCalculatorModal 
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        initialProduct={calcProduct}
      />
    </div>
  );
}
