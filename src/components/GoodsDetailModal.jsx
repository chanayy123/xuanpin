import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  Send, 
  Calculator, 
  Download, 
  ShieldCheck, 
  Package, 
  Building2, 
  Truck, 
  DollarSign, 
  Layers,
  Sparkles,
  ExternalLink,
  Award
} from 'lucide-react';

export default function GoodsDetailModal({ product, onClose, onOpenCalc, onOneClickList }) {
  if (!product) return null;

  const [selectedSku, setSelectedSku] = useState(product.skus[0]);
  const [selectedStore, setSelectedStore] = useState('TikTok-US-Shop-01');
  const [listingPrice, setListingPrice] = useState(product.suggestedRetailUsd);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handlePublish = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      onOneClickList(product, selectedStore, listingPrice);
      setTimeout(() => {
        setSyncSuccess(false);
      }, 2500);
    }, 1000);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '960px', padding: '28px' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-emerald">{product.deliveryMode}</span>
              <span className="badge badge-purple">{product.category}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)' }}>编号: {product.id}</span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-dark-main)' }}>
              {product.title}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark-muted)', margin: '4px 0 0 0' }}>
              {product.titleEn}
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'var(--bg-dark-hover)',
              border: '1px solid var(--border-dark)',
              color: 'var(--text-dark-muted)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body - 2 Columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '28px' }}>
          {/* Left Column: Image & Download Assets */}
          <div>
            <div style={{
              width: '100%',
              height: '320px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-dark)',
              marginBottom: '14px',
              position: 'relative'
            }}>
              <img 
                src={product.image} 
                alt={product.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(6px)',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                color: '#fff'
              }}>
                100% 独家源头高清图
              </div>
            </div>

            {/* Asset Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                <Download size={16} />
                <span>下载无水印爆款素材包 (含白底图)</span>
              </button>

              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onOpenCalc(product)}
              >
                <Calculator size={16} />
                <span>导入此商品到全成本测算器</span>
              </button>
            </div>
          </div>

          {/* Right Column: Pricing Tiers, SKUs, Certifications & Listing Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Wholesale Price Ladder */}
            <div className="card-glass" style={{ padding: '16px', background: 'var(--bg-dark-base)' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '10px' }}>
                工厂阶梯采购价 (出厂全包价)
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>10 - 100 件</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ¥{product.wholesalePriceCny.toFixed(1)}
                  </div>
                </div>

                <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>100 - 500 件</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ¥{(product.wholesalePriceCny * 0.92).toFixed(1)}
                  </div>
                </div>

                <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>500+ 件 (大宗)</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ¥{(product.wholesalePriceCny * 0.85).toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            {/* Factory Parameters & Certifications */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark-muted)' }}>
                <Building2 size={16} style={{ color: 'var(--accent-gold)' }} />
                <span>源头工厂: <b>{product.factoryLocation}</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark-muted)' }}>
                <Package size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>规格重量: <b>{product.weightKg} kg / {product.dimensionsCm}</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark-muted)' }}>
                <Truck size={16} style={{ color: '#34d399' }} />
                <span>发货时效: <b>24小时内调派发货</b></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-dark-muted)' }}>
                <ShieldCheck size={16} style={{ color: '#c084fc' }} />
                <span>出口认证: {product.certifications.map(c => <span key={c} className="badge badge-purple" style={{ fontSize: '0.65rem', marginRight: '4px' }}>{c}</span>)}</span>
              </div>
            </div>

            {/* SKU Specification Selection */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '8px' }}>
                规格 SKU 属性:
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {product.skus.map(sku => (
                  <button
                    key={sku.name}
                    onClick={() => setSelectedSku(sku)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: selectedSku.name === sku.name ? 'var(--primary)' : 'var(--border-dark)',
                      backgroundColor: selectedSku.name === sku.name ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-dark-base)',
                      color: selectedSku.name === sku.name ? 'var(--primary)' : 'var(--text-dark-muted)',
                      fontSize: '0.82rem',
                      fontWeight: selectedSku.name === sku.name ? '700' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    {sku.name} (库存 {sku.stock})
                  </button>
                ))}
              </div>
            </div>

            {/* One-Click Store Listing Form */}
            <div className="card-glass" style={{ padding: '18px', border: '1px solid var(--primary-glow)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Send size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-dark-main)' }}>
                  一键同步刊登到卖家店铺 (1-Click Sync)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                    目标对接店铺:
                  </label>
                  <select 
                    value={selectedStore}
                    onChange={(e) => setSelectedStore(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-dark-base)',
                      border: '1px solid var(--border-dark)',
                      color: 'var(--text-dark-main)',
                      fontSize: '0.85rem'
                    }}
                  >
                    <option value="TikTok-US-Shop-01">TikTok Shop 美国站 (#Shop-01)</option>
                    <option value="Amazon-FBA-US">Amazon 亚马逊 FBA (#US-Store)</option>
                    <option value="Temu-Global-02">Temu 托管全球店铺 (#Temu-02)</option>
                    <option value="Shopee-SEA-Main">Shopee 东南亚综合店 (#SEA-01)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                    店铺上架售价 (USD $):
                  </label>
                  <input 
                    type="number" 
                    value={listingPrice}
                    onChange={(e) => setListingPrice(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-dark-base)',
                      border: '1px solid var(--border-dark)',
                      color: 'var(--accent-gold)',
                      fontWeight: '700',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              {/* Publish Action Button */}
              <button 
                className="btn btn-primary"
                onClick={handlePublish}
                disabled={isSyncing}
                style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
              >
                {isSyncing ? (
                  <span>正在提交一键刊登任务...</span>
                ) : syncSuccess ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={18} />
                    已成功推送到刊登工作台看板！
                  </span>
                ) : (
                  <span>立即发布刊登至目标店铺</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
