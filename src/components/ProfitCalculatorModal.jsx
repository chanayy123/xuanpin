import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calculator, 
  DollarSign, 
  TrendingUp, 
  PieChart, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function ProfitCalculatorModal({ isOpen, onClose, initialProduct }) {
  if (!isOpen) return null;

  const [wholesaleCny, setWholesaleCny] = useState(initialProduct ? initialProduct.wholesalePriceCny : 28.5);
  const [retailUsd, setRetailUsd] = useState(initialProduct ? initialProduct.suggestedRetailUsd : 29.99);
  const [exchangeRate, setExchangeRate] = useState(7.18);
  const [shippingUsd, setShippingUsd] = useState(4.5);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(12);
  const [adSpendPct, setAdSpendPct] = useState(15);
  const [tariffPct, setTariffPct] = useState(3);

  // Calculated values
  const wholesaleUsd = wholesaleCny / exchangeRate;
  const platformCommissionUsd = retailUsd * (platformCommissionPct / 100);
  const adSpendUsd = retailUsd * (adSpendPct / 100);
  const tariffUsd = wholesaleUsd * (tariffPct / 100);

  const totalCostUsd = wholesaleUsd + shippingUsd + platformCommissionUsd + adSpendUsd + tariffUsd;
  const netProfitUsd = retailUsd - totalCostUsd;
  const netProfitCny = netProfitUsd * exchangeRate;
  const netProfitMarginPct = retailUsd > 0 ? (netProfitUsd / retailUsd) * 100 : 0;
  const roiPct = totalCostUsd > 0 ? (netProfitUsd / totalCostUsd) * 100 : 0;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '880px', padding: '28px' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Calculator size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-dark-main)' }}>
                跨境全成本与实际净利润测算器
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dark-dim)' }}>
                {initialProduct ? `测算商品: ${initialProduct.title}` : '支持采购、头程尾程、平台佣金及广告投流全链条测算'}
              </span>
            </div>
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

        {/* Modal Grid: Inputs on Left, Real-time Dashboard on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left Column: Parameter Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '6px' }}>
                采购单价 (人民币 ¥):
              </label>
              <input 
                type="number" 
                value={wholesaleCny} 
                onChange={(e) => setWholesaleCny(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--primary)', fontWeight: '700' }}
              />
            </div>

            <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '6px' }}>
                海外终端零售售价 (美元 $):
              </label>
              <input 
                type="number" 
                value={retailUsd} 
                onChange={(e) => setRetailUsd(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--accent-gold)', fontWeight: '700' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                  物流头尾程 (USD $):
                </label>
                <input 
                  type="number" 
                  value={shippingUsd} 
                  onChange={(e) => setShippingUsd(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--text-dark-main)' }}
                />
              </div>

              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                  实时汇率 (USD/CNY):
                </label>
                <input 
                  type="number" 
                  value={exchangeRate} 
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 7.18)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--text-dark-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                  平台佣金率 (%):
                </label>
                <input 
                  type="number" 
                  value={platformCommissionPct} 
                  onChange={(e) => setPlatformCommissionPct(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--text-dark-main)' }}
                />
              </div>

              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-dark-base)', border: '1px solid var(--border-dark)' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '4px' }}>
                  预估投流广告占比 (%):
                </label>
                <input 
                  type="number" 
                  value={adSpendPct} 
                  onChange={(e) => setAdSpendPct(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', color: 'var(--text-dark-main)' }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Output Summary & Visual Gauge */}
          <div className="card-glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'var(--bg-dark-base)' }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '14px' }}>
                测算结果看板 (Calculated Overview)
              </span>

              {/* Net Profit Big Display */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: netProfitUsd > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                border: '1px solid',
                borderColor: netProfitUsd > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dark-dim)', display: 'block' }}>单件净利润 (Net Profit)</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: netProfitUsd > 0 ? '#34d399' : '#fb7185' }}>
                  ${netProfitUsd.toFixed(2)} USD <span style={{ fontSize: '1rem', fontWeight: '600' }}>(≈ ¥{netProfitCny.toFixed(2)})</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>纯净利润率</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--accent-gold)' }}>
                    {netProfitMarginPct.toFixed(1)}%
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-dark-card)', border: '1px solid var(--border-dark)', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>投资回报率 (ROI)</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#c084fc' }}>
                    {roiPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown list */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-dark-muted)', display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px dashed var(--border-dark)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>采购货成本:</span>
                  <b>${wholesaleUsd.toFixed(2)} (¥{wholesaleCny.toFixed(1)})</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>头程/尾程物流:</span>
                  <b>${shippingUsd.toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>平台抽成佣金 ({platformCommissionPct}%):</span>
                  <b>${platformCommissionUsd.toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>广告营销投流 ({adSpendPct}%):</span>
                  <b>${adSpendUsd.toFixed(2)}</b>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-dark-dim)', textAlign: 'center' }}>
              💡 淘金出海选品评估: {netProfitMarginPct > 35 ? '✅ 极高利润率蓝海项目，推荐铺货大卖！' : '⚠️ 利润空间适中，建议优化投流成本。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
