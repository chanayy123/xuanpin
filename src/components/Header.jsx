import React from 'react';
import { 
  Compass, 
  Search, 
  Sparkles, 
  Calculator, 
  Layers, 
  Sun, 
  Moon, 
  Heart, 
  ShieldCheck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  isDarkMode, 
  setIsDarkMode,
  openAiModal,
  openCalcModal,
  favoritesCount,
  activeTab,
  setActiveTab
}) {
  return (
    <header style={{
      height: '70px',
      borderBottom: '1px solid var(--border-dark)',
      backgroundColor: 'var(--bg-dark-card)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px'
    }}>
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #6366f1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
          color: '#fff'
        }}>
          <Compass size={24} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              淘金出海
            </span>
            <span className="badge badge-emerald">商家选品中心</span>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)', margin: 0 }}>
            TaoJin Cross-Border Merchant Intelligence Selection
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ flex: 1, maxWidth: '440px', margin: '0 24px', position: 'relative' }}>
        <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dark-dim)' }} />
        <input 
          type="text" 
          placeholder="搜索爆款名称、SKU、出海品类或工厂关键字..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 42px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-dark-base)',
            border: '1px solid var(--border-dark)',
            color: 'var(--text-dark-main)',
            fontSize: '0.875rem',
            outline: 'none',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-dark-dim)',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Real-time Exchange Widget & Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Exchange Rate Mini Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '8px',
          background: 'var(--bg-dark-base)',
          border: '1px solid var(--border-dark)',
          fontSize: '0.75rem',
          color: 'var(--text-dark-muted)'
        }}>
          <RefreshCw size={12} className="glow-active" style={{ color: 'var(--primary)' }} />
          <span>汇率 USD/CNY <b>7.18</b></span>
        </div>

        {/* AI Selection Button */}
        <button className="btn btn-purple" onClick={openAiModal}>
          <Sparkles size={16} />
          <span>AI 选品助手</span>
        </button>

        {/* Profit Calc Button */}
        <button className="btn btn-secondary" onClick={openCalcModal}>
          <Calculator size={16} />
          <span>利润测算</span>
        </button>

        {/* Favorites Quick Access */}
        <button 
          className="btn btn-outline" 
          onClick={() => setActiveTab('favorites')}
          style={{ position: 'relative' }}
        >
          <Heart size={16} style={{ color: favoritesCount > 0 ? '#f43f5e' : 'currentColor', fill: favoritesCount > 0 ? '#f43f5e' : 'none' }} />
          <span>收藏</span>
          {favoritesCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#f43f5e',
              color: '#fff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {favoritesCount}
            </span>
          )}
        </button>

        {/* Theme Toggle Button */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="btn btn-outline"
          title="切换深浅主题"
          style={{ padding: '8px 10px' }}
        >
          {isDarkMode ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} style={{ color: '#6366f1' }} />}
        </button>

        {/* User Info Avatar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          paddingLeft: '12px',
          borderLeft: '1px solid var(--border-dark)'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            color: '#fff',
            fontSize: '0.85rem'
          }}>
            卖家
          </div>
          <div style={{ lineHeight: '1.2' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              淘金金牌卖家
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dark-dim)' }}>Sellers ID: #88204</span>
          </div>
        </div>
      </div>
    </header>
  );
}
