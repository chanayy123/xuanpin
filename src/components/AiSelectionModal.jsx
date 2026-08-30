import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Send, 
  Bot, 
  TrendingUp, 
  Target, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function AiSelectionModal({ isOpen, onClose, onSelectProduct, products }) {
  if (!isOpen) return null;

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState(null);

  const presets = [
    "🔥 2026年北美夏季露营高毛利蓝海选品分析",
    "📱 TikTok爆款短视频高转化好物推荐 (<$30)",
    "⚡ 亚马逊高客单痛点改善产品 (预估毛利>65%)",
    "🐾 宠物赛道循环饮水机及智能用品趋势"
  ];

  const handleGenerate = (customPrompt) => {
    const queryText = customPrompt || prompt || presets[0];
    setPrompt(queryText);
    setIsGenerating(true);
    setReport(null);

    setTimeout(() => {
      setIsGenerating(false);
      setReport({
        query: queryText,
        blueOceanScore: 95,
        growthRate: "+320%",
        competitionSaturation: "低 (低于18%)",
        recommendedPrice: "$29.99 - $49.99",
        marketingAngle: "主打「科技痛点解决 + 沉浸式场景短视频带货」。突出高防水、防干烧及一键清理体验。",
        matchedProducts: products.slice(0, 3)
      });
    }, 1200);
  };

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '850px', padding: '28px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Bot size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-dark-main)' }}>
                淘金 AI 智能选品与商机挖掘助手
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dark-dim)' }}>
                基于百万级海关数据、TikTok大盘趋势及亚马逊关键词热度算法
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

        {/* Input & Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              rows={3}
              placeholder="请输入您的选品需求，例如：帮我分析北美宠物赛道低于$30美元的高毛利爆款，或推荐TikTok近期增量明显的户外商品..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-dark-base)',
                border: '1px solid var(--border-dark-bright)',
                color: 'var(--text-dark-main)',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>

          {/* Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dark-dim)' }}>热门提示词:</span>
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handleGenerate(preset)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-dark)',
                  backgroundColor: 'var(--bg-dark-base)',
                  color: 'var(--text-dark-muted)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          <button 
            className="btn btn-purple" 
            onClick={() => handleGenerate()}
            disabled={isGenerating}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
          >
            <Sparkles size={18} />
            <span>{isGenerating ? 'AI 正在深度解析大盘商机...' : '立即生成 AI 选品洞察报告'}</span>
          </button>
        </div>

        {/* AI Report Result Display */}
        {report && (
          <div className="card-glass animate-fade-in" style={{ padding: '20px', border: '1px solid var(--secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-purple">AI 选品深度报告</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dark-dim)' }}>解析主题: {report.query}</span>
              </div>
              <span className="badge badge-emerald">实时算力评估完毕</span>
            </div>

            {/* Score Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>蓝海指数</span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#c084fc' }}>{report.blueOceanScore} / 100</div>
              </div>

              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>7天搜索飙升</span>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#34d399' }}>{report.growthRate}</div>
              </div>

              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>竞品饱和度</span>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#38bdf8' }}>{report.competitionSaturation}</div>
              </div>

              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-dark-base)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>建议零售区间</span>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fbbf24' }}>{report.recommendedPrice}</div>
              </div>
            </div>

            {/* Marketing Angle */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '20px',
              fontSize: '0.85rem',
              color: '#a5b4fc'
            }}>
              <b>💡 营销打法策略建议:</b> {report.marketingAngle}
            </div>

            {/* Matched Products */}
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark-muted)', display: 'block', marginBottom: '10px' }}>
              匹配的最佳源头爆款货源:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {report.matchedProducts.map(p => (
                <div 
                  key={p.id}
                  onClick={() => { onClose(); onSelectProduct(p); }}
                  style={{
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-dark-base)',
                    border: '1px solid var(--border-dark)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <img src={p.image} alt={p.title} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px' }} />
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', height: '36px', overflow: 'hidden' }}>{p.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--primary)' }}>¥{p.wholesalePriceCny}</span>
                    <span style={{ color: '#fbbf24' }}>毛利 {p.profitMargin}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
