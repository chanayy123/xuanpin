import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Info, X } from 'lucide-react';

const numeric = (setter, fallback = 0) => (event) => setter(Number(event.target.value) || fallback);

export default function ProfitCalculatorModal({ isOpen, onClose, initialProduct }) {
  const [wholesaleCny, setWholesaleCny] = useState(0);
  const [retailUsd, setRetailUsd] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(7.18);
  const [shippingUsd, setShippingUsd] = useState(0);
  const [platformPct, setPlatformPct] = useState(0);
  const [adPct, setAdPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [returnLossPct, setReturnLossPct] = useState(0);

  useEffect(() => {
    setWholesaleCny(initialProduct?.price.minCny || 0);
    setRetailUsd(0);
    setShippingUsd(0);
    setPlatformPct(0);
    setAdPct(0);
    setTaxPct(0);
    setReturnLossPct(0);
  }, [initialProduct, isOpen]);

  const result = useMemo(() => {
    const wholesaleUsd = exchangeRate > 0 ? wholesaleCny / exchangeRate : 0;
    const platform = retailUsd * platformPct / 100;
    const ads = retailUsd * adPct / 100;
    const tax = retailUsd * taxPct / 100;
    const returns = retailUsd * returnLossPct / 100;
    const totalCost = wholesaleUsd + shippingUsd + platform + ads + tax + returns;
    const netProfit = retailUsd - totalCost;
    return { wholesaleUsd, platform, ads, tax, returns, totalCost, netProfit, margin: retailUsd > 0 ? netProfit / retailUsd * 100 : null, roi: totalCost > 0 ? netProfit / totalCost * 100 : null };
  }, [wholesaleCny, retailUsd, exchangeRate, shippingUsd, platformPct, adPct, taxPct, returnLossPct]);

  if (!isOpen) return null;
  return <div className="modal-overlay" onClick={onClose}><div className="modal-content calc-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20} /></button><div className="calc-heading"><div className="modal-heading-icon"><Calculator size={23} /></div><div><h2>全成本情景测算</h2><p>{initialProduct ? `商品 #${initialProduct.id} · ${initialProduct.title}` : '请录入你的真实售价与费用假设'}</p></div></div><div className="scenario-note"><Info size={17} /><span>系统不会自动填入未经验证的市场售价、运费或平台费。以下结果完全基于你的输入，不是利润承诺。</span></div><div className="calc-layout"><section className="calc-inputs"><h3>情景参数</h3><div className="input-grid"><Field label="采购价 CNY" value={wholesaleCny} onChange={numeric(setWholesaleCny)} /><Field label="预期售价 USD" value={retailUsd} onChange={numeric(setRetailUsd)} /><Field label="USD/CNY 汇率" value={exchangeRate} step="0.01" onChange={numeric(setExchangeRate, 7.18)} /><Field label="头程+尾程 USD" value={shippingUsd} onChange={numeric(setShippingUsd)} /><Field label="平台费用 %" value={platformPct} onChange={numeric(setPlatformPct)} /><Field label="广告成本 %" value={adPct} onChange={numeric(setAdPct)} /><Field label="税费 %" value={taxPct} onChange={numeric(setTaxPct)} /><Field label="退款/损耗 %" value={returnLossPct} onChange={numeric(setReturnLossPct)} /></div></section><section className="calc-results"><h3>测算结果</h3><div className={`profit-result ${result.netProfit >= 0 ? 'positive' : 'negative'}`}><small>单件情景净利润</small><strong>${result.netProfit.toFixed(2)}</strong><span>{result.margin == null ? '请先填写售价' : `净利率 ${result.margin.toFixed(1)}%`}</span></div><dl><div><dt>采购成本</dt><dd>${result.wholesaleUsd.toFixed(2)}</dd></div><div><dt>物流成本</dt><dd>${shippingUsd.toFixed(2)}</dd></div><div><dt>平台费用</dt><dd>${result.platform.toFixed(2)}</dd></div><div><dt>广告成本</dt><dd>${result.ads.toFixed(2)}</dd></div><div><dt>税费</dt><dd>${result.tax.toFixed(2)}</dd></div><div><dt>退款/损耗</dt><dd>${result.returns.toFixed(2)}</dd></div><div className="total"><dt>总成本</dt><dd>${result.totalCost.toFixed(2)}</dd></div><div><dt>成本 ROI</dt><dd>{result.roi == null ? '—' : `${result.roi.toFixed(1)}%`}</dd></div></dl></section></div></div></div>;
}

function Field({ label, value, onChange, step = '0.1' }) { return <label className="calc-field"><span>{label}</span><input type="number" min="0" step={step} value={value} onChange={onChange} /></label>; }
