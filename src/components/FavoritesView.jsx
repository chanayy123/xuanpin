import React from 'react';
import { 
  Heart, 
  Trash2, 
  Send, 
  Eye, 
  Calculator, 
  ShoppingBag,
  Download
} from 'lucide-react';

export default function FavoritesView({ 
  favoriteProducts, 
  onSelectProduct, 
  onToggleFavorite, 
  onOneClickList,
  onOpenCalc 
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card-glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-rose">我的选品库</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dark-dim)' }}>支持批量导出及一键推送到多平台店铺</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
            已收藏的高潜力爆款 ({favoriteProducts.length})
          </h2>
        </div>

        {favoriteProducts.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline">
              <Download size={16} />
              <span>导出选品清单 (CSV/XLS)</span>
            </button>
          </div>
        )}
      </div>

      {favoriteProducts.length === 0 ? (
        <div className="card-glass" style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-dark-dim)' }}>
          <Heart size={48} style={{ opacity: 0.2, marginBottom: '12px', color: '#f43f5e' }} />
          <p style={{ fontSize: '1rem', fontWeight: '600' }}>您的选品库还是空的</p>
          <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0' }}>在选品大厅点击爱心图标，即可在此集中管理预备铺货商品。</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {favoriteProducts.map(product => (
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
              <div style={{ position: 'relative', height: '200px', width: '100%' }}>
                <img 
                  src={product.image} 
                  alt={product.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  onClick={() => onToggleFavorite(product.id)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#f43f5e',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="移除收藏"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, height: '40px', overflow: 'hidden' }}>
                  {product.title}
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span>批发: <b style={{ color: 'var(--primary)' }}>¥{product.wholesalePriceCny}</b></span>
                  <span>建议售价: <b style={{ color: 'var(--accent-gold)' }}>${product.suggestedRetailUsd}</b></span>
                  <span className="badge badge-emerald">毛利 {product.profitMargin}%</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: 'auto' }}>
                  <button className="btn btn-secondary" onClick={() => onSelectProduct(product)} style={{ fontSize: '0.8rem' }}>
                    <Eye size={14} />
                    <span>查看详情</span>
                  </button>
                  <button className="btn btn-primary" onClick={() => onOneClickList(product)} style={{ fontSize: '0.8rem' }}>
                    <Send size={14} />
                    <span>一键铺货</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
