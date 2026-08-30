import React, { useState } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  Filter, 
  ArrowUpDown, 
  Heart, 
  Send, 
  Calculator, 
  Eye, 
  CheckCircle2, 
  ShieldAlert,
  Globe,
  Truck,
  Building,
  Award,
  Zap,
  ShoppingBag
} from 'lucide-react';
import { platformOptions, categoryOptions, regionOptions } from '../data/mockProducts';

export default function SelectionHub({ 
  products, 
  onSelectProduct, 
  onOpenCalc, 
  onToggleFavorite, 
  favoriteIds, 
  onOneClickList 
}) {
  const [selectedCategory, setSelectedCategory] = useState('全部类目');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [deliveryMode, setDeliveryMode] = useState('ALL');
  const [minProfit, setMinProfit] = useState(0);
  const [sortBy, setSortBy] = useState('growth'); // growth | profit | price | rating

  // Filter products logic
  const filteredProducts = products.filter(product => {
    if (selectedCategory !== '全部类目' && product.category !== selectedCategory) return false;
    if (selectedPlatform !== 'all' && !product.targetPlatforms.includes(selectedPlatform)) return false;
    if (selectedRegion !== 'ALL' && !product.targetRegions.includes(selectedRegion)) return false;
    if (deliveryMode !== 'ALL' && product.deliveryMode !== deliveryMode) return false;
    if (product.profitMargin < minProfit) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'growth') return b.growth7d - a.growth7d;
    if (sortBy === 'profit') return b.profitMargin - a.profitMargin;
    if (sortBy === 'price') return a.wholesalePriceCny - b.wholesalePriceCny;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Banner / Hero Card */}
      <div style={{
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 50%, rgba(139, 92, 246, 0.15) 100%)',
        border: '1px solid var(--border-dark-bright)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '650px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span className="badge badge-emerald">2026 跨境出海选品选盘</span>
            <span className="badge badge-amber">源头工厂直供率 100%</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 8px 0', lineHeight: '1.3' }}>
            淘金出海 · 商家高毛利选品大厅
          </h1>
          <p style={{ color: 'var(--text-dark-muted)', fontSize: '0.9rem', margin: 0 }}>
            挖掘 TikTok Viral 爆款、亚马逊高客单及 Temu 快速走量好物。全量商品提供海外仓现货、合规出口认证及一键多平台刊登铺货支持。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', zIndex: 1 }}>
          <div className="card-glass" style={{ padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>8,500+</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)' }}>实时爆款库</div>
          </div>
          <div className="card-glass" style={{ padding: '12px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--accent-gold)' }}>62.4%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)' }}>平均预估毛利</div>
          </div>
        </div>
      </div>

      {/* Filtering Section */}
      <div className="card-glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Category Tags Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark-muted)', minWidth: '70px' }}>
            出海品类:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {categoryOptions.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? 'var(--primary)' : 'var(--border-dark)',
                  backgroundColor: selectedCategory === cat ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-dark-base)',
                  color: selectedCategory === cat ? 'var(--primary)' : 'var(--text-dark-muted)',
                  fontSize: '0.85rem',
                  fontWeight: selectedCategory === cat ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Target Platform Chips Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark-muted)', minWidth: '70px' }}>
            目标平台:
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {platformOptions.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: selectedPlatform === p.id ? 'var(--secondary)' : 'var(--border-dark)',
                  backgroundColor: selectedPlatform === p.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-dark-base)',
                  color: selectedPlatform === p.id ? '#a5b4fc' : 'var(--text-dark-muted)',
                  fontSize: '0.85rem',
                  fontWeight: selectedPlatform === p.id ? '700' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                <span>{p.name}</span>
                {p.badge && (
                  <span className="badge badge-amber" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                    {p.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Filter Selectors & Sort Control */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingTop: '12px',
          borderTop: '1px dashed var(--border-dark)',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Region Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Globe size={16} style={{ color: 'var(--text-dark-dim)' }} />
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-dark-base)',
                  border: '1px solid var(--border-dark)',
                  color: 'var(--text-dark-main)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                {regionOptions.map(r => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            {/* Delivery Mode Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={16} style={{ color: 'var(--text-dark-dim)' }} />
              <select
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-dark-base)',
                  border: '1px solid var(--border-dark)',
                  color: 'var(--text-dark-main)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              >
                <option value="ALL">所有发货模式</option>
                <option value="海外仓现货">海外仓现货 (24h派送)</option>
                <option value="工厂直发">源头工厂直发 (包邮)</option>
              </select>
            </div>

            {/* Profit Margin Preset filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dark-muted)' }}>最低预估毛利:</span>
              <button 
                className={`badge ${minProfit === 60 ? 'badge-emerald' : 'badge-cyan'}`}
                onClick={() => setMinProfit(minProfit === 60 ? 0 : 60)}
                style={{ cursor: 'pointer', padding: '5px 10px', fontSize: '0.75rem' }}
              >
                &gt; 60% 高毛利
              </button>
            </div>
          </div>

          {/* Sort selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowUpDown size={16} style={{ color: 'var(--text-dark-dim)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dark-muted)' }}>排序规则:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { id: 'growth', label: '7天销量飙升' },
                { id: 'profit', label: '毛利率最高' },
                { id: 'price', label: '采购价格低' },
                { id: 'rating', label: '满意评价高' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: sortBy === s.id ? 'var(--primary)' : 'var(--bg-dark-base)',
                    color: sortBy === s.id ? '#fff' : 'var(--text-dark-muted)',
                    fontSize: '0.8rem',
                    fontWeight: sortBy === s.id ? '700' : '500',
                    cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product List Grid Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-dark-muted)' }}>
          已为您精选 <b style={{ color: 'var(--primary)' }}>{filteredProducts.length}</b> 款高质量出海货源商品
        </div>
      </div>

      {/* Product Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {filteredProducts.map(product => {
          const isFav = favoriteIds.includes(product.id);
          return (
            <div 
              key={product.id}
              className="card-glass animate-fade-in"
              style={{
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative'
              }}
            >
              {/* Product Image & Badges */}
              <div style={{ position: 'relative', height: '220px', width: '100%', backgroundColor: '#000' }}>
                <img 
                  src={product.image} 
                  alt={product.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.9,
                    transition: 'transform 0.4s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                />
                
                {/* Hot Tag Badge */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                  <span className="badge badge-amber" style={{ backdropFilter: 'blur(8px)', background: 'rgba(245, 158, 11, 0.85)', color: '#000' }}>
                    <Zap size={12} />
                    {product.hotTag}
                  </span>
                  <span className="badge badge-emerald" style={{ backdropFilter: 'blur(8px)', background: 'rgba(16, 185, 129, 0.85)', color: '#fff' }}>
                    {product.deliveryMode}
                  </span>
                </div>

                {/* Favorite Heart Toggle */}
                <button
                  onClick={() => onToggleFavorite(product.id)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isFav ? '#f43f5e' : '#fff',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  title={isFav ? '取消收藏' : '加入选品库'}
                >
                  <Heart size={18} style={{ fill: isFav ? '#f43f5e' : 'none' }} />
                </button>

                {/* AI Opportunity Score Badge */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(6px)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Sparkles size={14} style={{ color: '#a855f7' }} />
                  <span style={{ color: 'var(--text-dark-muted)' }}>AI 选品指数:</span>
                  <b style={{ color: '#c084fc' }}>{product.aiScore}分</b>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '14px' }}>
                {/* Category & Title */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)', marginBottom: '4px' }}>
                    {product.category} · {product.factoryLocation}
                  </div>
                  <h3 
                    onClick={() => onSelectProduct(product)}
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      lineHeight: '1.4',
                      color: 'var(--text-dark-main)',
                      cursor: 'pointer',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {product.title}
                  </h3>
                </div>

                {/* Prices & Profit Margin Box */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-dark-base)',
                  border: '1px solid var(--border-dark)'
                }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dark-dim)', display: 'block' }}>工厂批发单价</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)' }}>
                      ¥{product.wholesalePriceCny.toFixed(1)}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dark-dim)', display: 'block' }}>海外建议零售价</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--accent-gold)' }}>
                      ${product.suggestedRetailUsd}
                    </span>
                  </div>

                  <div style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.65rem', color: '#34d399', display: 'block' }}>预估毛利</span>
                    <b style={{ fontSize: '0.9rem', color: '#34d399' }}>{product.profitMargin}%</b>
                  </div>
                </div>

                {/* Platforms Tags & Certifications */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {product.targetPlatforms.map(plat => (
                      <span key={plat} className="badge badge-purple" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                        {plat}
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={14} style={{ color: '#34d399' }} />
                    <span>7天飙升 <b>+{product.growth7d}%</b></span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto', paddingTop: '6px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => onSelectProduct(product)}
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  >
                    <Eye size={14} />
                    <span>详情 / 刊登</span>
                  </button>

                  <button 
                    className="btn btn-primary"
                    onClick={() => onOneClickList(product)}
                    style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  >
                    <Send size={14} />
                    <span>一键铺货</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
