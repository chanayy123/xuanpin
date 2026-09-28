import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Info, X } from 'lucide-react';

const empty = { income: '', purchase: '', printing: '', packaging: '', shipping: '', fees: '', ads: '', tax: '', returns: '', exchange: '', retail: '' };
const fields = [{ key: 'purchase', label: '同 SKU 供货成本 CNY' }, { key: 'printing', label: '未包含的印刷成本 CNY' }, { key: 'packaging', label: '未包含的包装成本 CNY' }, { key: 'shipping', label: '你承担的物流费用 CNY' }, { key: 'fees', label: '未扣除的平台费用 CNY' }, { key: 'ads', label: '分摊广告费用 CNY' }, { key: 'tax', label: '未扣除的税费 CNY' }, { key: 'returns', label: '退款与损耗摊销 CNY' }];
const validNumber = (value) => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
export default function ProfitCalculatorModal({ isOpen, onClose, initialProduct }) {
  const [values, setValues] = useState(empty);
  const [mode, setMode] = useState('settlement');
  const [skuId, setSkuId] = useState('');
  const skus = initialProduct?.skus || [];
  useEffect(() => {
    if (!isOpen) return;
    const sku = [...skus].filter((item) => item.supplyPriceCny != null).sort((a, b) => a.supplyPriceCny - b.supplyPriceCny)[0];
    setSkuId(sku?.id ? String(sku.id) : ''); setValues({ ...empty, purchase: sku?.supplyPriceCny ?? '' }); setMode('settlement');
  }, [initialProduct, isOpen]);
  const selectedSku = skus.find((sku) => String(sku.id) === skuId);
  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  const result = useMemo(() => {
    const completeCosts = fields.every(({ key }) => validNumber(values[key]));
    const revenueReady = mode === 'settlement' ? validNumber(values.income) && Number(values.income) > 0 : validNumber(values.retail) && Number(values.retail) > 0 && validNumber(values.exchange) && Number(values.exchange) > 0;
    if (!completeCosts || !revenueReady) return null;
    const income = mode === 'settlement' ? Number(values.income) : Number(values.retail) * Number(values.exchange);
    const cost = fields.reduce((sum, { key }) => sum + Number(values[key]), 0);
    return { income, cost, profit: income - cost, margin: (income - cost) / income * 100 };
  }, [values, mode]);
  if (!isOpen) return null;
  const selectSku = (id) => { setSkuId(id); setValue('purchase', skus.find((sku) => String(sku.id) === id)?.supplyPriceCny ?? ''); };
  return <div className="modal-overlay calc-overlay" onClick={onClose}><div className="modal-content calc-modal" role="dialog" aria-modal="true" aria-labelledby="calculator-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="关闭成本测算"><X size={20} /></button><div className="calc-heading"><div className="modal-heading-icon"><Calculator size={23} /></div><div><h2 id="calculator-title">把完整成本算清楚</h2><p>{initialProduct ? `#${initialProduct.id} · ${initialProduct.title}` : '输入同一 SKU、同一包装单位的真实核价与成本'}</p></div></div><div className="calculator-mode"><button className={mode === 'settlement' ? 'active' : ''} onClick={() => setMode('settlement')}>核价 / 结算收入</button><button className={mode === 'retail' ? 'active' : ''} onClick={() => setMode('retail')}>自定零售价情景</button></div><div className="scenario-note"><Info size={17} /><span>{mode === 'settlement' ? '录入实际归属于你的单 SKU 收入。费用若已从结算额扣除，请不要重复计入；确认无需承担的项目填 0。' : '零售价情景仅用于自行承担零售收支的模式；Temu 消费者美元标价不能视为全托管卖家收入。'} 所有金额按相同 SKU 整包计，不自动拆成单件。</span></div>{skus.length > 0 && <label className="sku-select"><span>选择实际报价 SKU</span><select value={skuId} onChange={(event) => selectSku(event.target.value)}>{!skuId && <option value="">请选择 SKU</option>}{skus.map((sku) => <option key={sku.id} value={sku.id}>#{sku.id} · {sku.specs.map((spec) => `${spec.name}：${spec.value}`).join(' / ') || '未标注规格'} · ¥{sku.supplyPriceCny ?? '待补'}</option>)}</select><small>该 SKU 实重 {selectedSku?.weightG ?? '未知'} g · 运费请按最终包装报价确认</small></label>}<div className="calc-layout"><section className="calc-inputs"><h3>收入与成本 · 每个 SKU 整包</h3><div className="input-grid">{mode === 'settlement' ? <Field label="真实核价 / 结算收入 CNY" value={values.income} onChange={(value) => setValue('income', value)} /> : <><Field label="假设零售价 USD" value={values.retail} onChange={(value) => setValue('retail', value)} /><Field label="情景汇率 CNY / USD" value={values.exchange} onChange={(value) => setValue('exchange', value)} /></>}{fields.map(({ key, label }) => <Field key={key} label={label} value={values[key]} onChange={(value) => setValue(key, value)} />)}</div></section><section className="calc-results"><h3>当前情景结果</h3><div className={`profit-result ${result && result.profit >= 0 ? 'positive' : result ? 'negative' : 'incomplete'}`}><small>单 SKU 情景贡献利润</small><strong>{result ? `¥${result.profit.toFixed(2)}` : '等待完整输入'}</strong><span>{result ? `贡献利润率 ${result.margin.toFixed(1)}%` : '未知费用保持为空，不自动按 0 处理'}</span></div><dl><div><dt>收入</dt><dd>{result ? `¥${result.income.toFixed(2)}` : '—'}</dd></div><div><dt>成本合计</dt><dd>{result ? `¥${result.cost.toFixed(2)}` : '—'}</dd></div><div className="total"><dt>收支平衡收入</dt><dd>{result ? `¥${result.cost.toFixed(2)}` : '—'}</dd></div></dl><p className="calc-footnote">这里计算已填项目的贡献利润，尚未涵盖未填入的固定成本。没有实际订单数据时，结果仅为情景假设。</p></section></div></div></div>;
}
function Field({ label, value, onChange }) { return <label className="calc-field"><span>{label}</span><input type="number" min="0" step="0.01" value={value} placeholder="待填写" onChange={(event) => onChange(event.target.value)} /></label>; }
