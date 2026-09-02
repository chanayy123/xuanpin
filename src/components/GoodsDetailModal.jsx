import React from 'react';
import { AlertTriangle, Calculator, CheckCircle2, ClipboardPlus, ExternalLink, PackageOpen, X } from 'lucide-react';

const labels = { completeness: '数据完整度', logistics: '物流适配', fulfillment: '发货时效', testCost: '低成本测款', differentiation: '差异化能力', compliance: '合规与售后' };
const maximums = { completeness: 15, logistics: 20, fulfillment: 15, testCost: 15, differentiation: 20, compliance: 15 };

export default function GoodsDetailModal({ product, shortlisted, onClose, onToggleShortlist, onOpenCalc }) {
  if (!product) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        <div className="detail-hero">
          <div className="detail-image">{product.images[0] ? <img src={product.images[0]} alt={product.title} /> : <PackageOpen size={44} />}</div>
          <div className="detail-intro">
            <div className="detail-tags"><span className="badge badge-cyan">#{product.id}</span><span className="badge badge-emerald">{product.assessment.status}</span><span className="badge badge-purple">证据 {product.assessment.confidence}%</span></div>
            <h2>{product.title}</h2>
            <p>{product.category.breadcrumbs?.map((item) => item.name).join(' / ') || product.category.name}</p>
            <div className="detail-score"><strong>{product.assessment.score}</strong><span>/100<br />运营测款适配分</span></div>
            <div className="detail-actions"><button className={shortlisted ? 'btn btn-primary' : 'btn btn-secondary'} onClick={() => onToggleShortlist(product)}><ClipboardPlus size={16} />{shortlisted ? '已加入测款清单' : '加入测款清单'}</button><button className="btn btn-secondary" onClick={() => onOpenCalc(product)}><Calculator size={16} />情景测算</button><a className="btn btn-outline" href={product.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />源站详情</a></div>
          </div>
        </div>

        <div className="detail-grid">
          <section className="detail-section"><h3>可核验商品事实</h3><dl className="fact-list"><div><dt>供货价</dt><dd>¥{product.price.minCny ?? '—'}{product.price.maxCny !== product.price.minCny ? ` – ¥${product.price.maxCny}` : ''}</dd></div><div><dt>重量区间</dt><dd>{product.weight.minG ?? '—'}g – {product.weight.maxG ?? '—'}g</dd></div><div><dt>最大计费重量</dt><dd>{product.assessment.chargeableMaxG ?? '—'}g</dd></div><div><dt>发货/仓库</dt><dd>{product.delivery.text || '—'} · {product.warehouse || '—'}</dd></div><div><dt>材质/工艺</dt><dd>{product.material || '—'} · {product.craft || '—'}</dd></div><div><dt>适用平台</dt><dd>{product.platforms.join('、') || '—'}</dd></div></dl></section>
          <section className="detail-section"><h3>评分拆解</h3><div className="breakdown-list">{Object.entries(product.assessment.breakdown).map(([key, value]) => <div key={key}><span>{labels[key]}</span><div><i style={{ width: `${value / maximums[key] * 100}%` }} /></div><strong>{value}/{maximums[key]}</strong></div>)}</div></section>
        </div>

        <div className="detail-grid evidence-grid">
          <section className="detail-section"><h3><CheckCircle2 size={18} />加分依据</h3><ul>{product.assessment.reasons.length ? product.assessment.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>暂无明确加分依据</li>}</ul></section>
          <section className="detail-section risks"><h3><AlertTriangle size={18} />风险与待验证项</h3><ul>{[...product.assessment.risks, '没有可信市场售价、销量或竞争度数据，最终需求与利润仍需人工验证'].map((risk) => <li key={risk}>{risk}</li>)}</ul></section>
        </div>

        <section className="detail-section sku-section"><h3>SKU 与规格（{product.skus.length}）</h3>{product.skus.length ? <div className="sku-table"><div className="sku-row header"><span>规格</span><span>供货价</span><span>重量</span><span>尺寸 cm</span></div>{product.skus.map((sku) => <div className="sku-row" key={sku.id}><span>{sku.specs.map((spec) => `${spec.name}: ${spec.value}`).join(' / ') || `SKU ${sku.id}`}</span><span>{sku.supplyPriceCny == null ? '—' : `¥${sku.supplyPriceCny}`}</span><span>{sku.weightG == null ? '—' : `${sku.weightG}g`}</span><span>{[sku.dimensions.lengthCm, sku.dimensions.widthCm, sku.dimensions.heightCm].map((value) => value ?? '—').join(' × ')}</span></div>)}</div> : <p className="muted">详情接口未提供 SKU。</p>}</section>
        <p className="data-footnote">首次发现：{new Date(product.firstSeenAt).toLocaleString('zh-CN', { hour12: false })} · 最近变化：{new Date(product.lastChangedAt).toLocaleString('zh-CN', { hour12: false })}</p>
      </div>
    </div>
  );
}
