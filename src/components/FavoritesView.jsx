import React, { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Calculator, ClipboardList, ExternalLink, Trash2 } from 'lucide-react';
import { csvCell, downloadText, ProductImage } from './uiUtils';

const stages = ['待设计', '待打样', '样品复核', '待上架', '测试中', '已验证', '暂缓'];
export default function FavoritesView({ products, catalogProducts, entries, onToggleShortlist, onUpdateNote, onUpdateEntry, onImportEntries, onSelectProduct, onOpenCalc, onBrowse }) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('全部');
  const visibleProducts = products.filter((product) => filter === '全部' || (entries[product.id]?.stage || '待设计') === filter);
  const exportData = (format) => {
    if (format === 'json') { downloadText('我的测款清单.json', JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), entries }, null, 2), 'application/json'); return; }
    const rows = [['商品ID', '商品名称', '进度', '供应类目', '加入时间', '运营备注', '来源'], ...products.map((product) => [product.id, product.title, entries[product.id]?.stage || '待设计', product.category.name, entries[product.id]?.addedAt, entries[product.id]?.note, product.sourceUrl])];
    downloadText('我的测款清单.csv', rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const importData = async (event) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('文件超过 2 MB，请使用本工作台导出的 JSON。');
      const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      if (parsed.schemaVersion !== 1 || !parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) throw new Error('文件格式不符，请导入本工作台导出的 JSON 清单。');
      const known = new Set(catalogProducts.map((product) => String(product.id))); const imported = {}; let skipped = 0;
      for (const [id, entry] of Object.entries(parsed.entries)) {
        if (!known.has(id) || !entry || typeof entry !== 'object' || Array.isArray(entry)) { skipped += 1; continue; }
        imported[id] = { addedAt: typeof entry.addedAt === 'string' && Number.isFinite(new Date(entry.addedAt).getTime()) ? entry.addedAt : new Date().toISOString(), note: typeof entry.note === 'string' ? entry.note.slice(0, 4000) : '', stage: stages.includes(entry.stage) ? entry.stage : '待设计' };
      }
      onImportEntries(imported); setMessage(`已合并 ${Object.keys(imported).length} 条记录${skipped ? `；跳过 ${skipped} 条当前目录无法对应的记录` : ''}。同商品的进度与备注采用导入值。`);
    } catch (error) { setMessage(`导入失败：${error.message}`); }
  };
  return <div className="shortlist-page animate-fade-in"><section className="page-heading"><div><span className="eyebrow">YOUR TESTING PIPELINE</span><h1>从一个想法，到一次验证。</h1><p>本机浏览器保存的测款清单。记录设计、样品和真实测试结果，可导出备份或转交同事。</p></div><div className="page-heading-actions"><button className="btn btn-outline" onClick={() => inputRef.current?.click()}><ArrowUpFromLine size={15} />导入合并</button><button className="btn btn-secondary" onClick={() => exportData('json')} disabled={!products.length}>备份 JSON</button><button className="btn btn-primary" onClick={() => exportData('csv')} disabled={!products.length}><ArrowDownToLine size={15} />导出清单</button><input type="file" accept=".json,application/json" hidden ref={inputRef} onChange={importData} /></div></section>{message && <p className="inline-feedback" role="status">{message}</p>}<div className="shortlist-stages"><button className={filter === '全部' ? 'active' : ''} onClick={() => setFilter('全部')}>全部 <b>{products.length}</b></button>{stages.map((stage) => <button key={stage} className={filter === stage ? 'active' : ''} onClick={() => setFilter(stage)}>{stage} <b>{products.filter((product) => (entries[product.id]?.stage || '待设计') === stage).length}</b></button>)}</div>{visibleProducts.length === 0 ? <div className="empty-state card-glass"><ClipboardList size={40} /><h3>{products.length ? '当前进度下暂无商品' : '从值得验证的方向开始'}</h3><p>{products.length ? '可切换进度筛选查看其他候选。' : '在品类推荐或供应目录中加入商品，在这里跟踪每一步。'}</p><button className="btn btn-primary" onClick={products.length ? () => setFilter('全部') : onBrowse}>{products.length ? '查看全部清单' : '浏览推荐品类'}</button></div> : <div className="shortlist-table card-glass">{visibleProducts.map((product) => <article className="shortlist-row" key={product.id}><button className="shortlist-product" onClick={() => onSelectProduct(product)}><ProductImage src={product.images[0]} /><div><small>#{product.id} · {product.category.name}</small><strong>{product.title}</strong><p>供应最低价 ¥{product.price.minCny ?? '—'} · 请核对同 SKU 报价</p></div></button><div className="shortlist-record"><label><span>当前进度</span><select value={entries[product.id]?.stage || '待设计'} onChange={(event) => onUpdateEntry(product.id, { stage: event.target.value })} aria-label={`${product.title} 的测试进度`}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><textarea value={entries[product.id]?.note || ''} maxLength={4000} onChange={(event) => onUpdateNote(product.id, event.target.value)} placeholder="记录 SKU、核价、样品结果、订单或复盘结论…" aria-label={`${product.title} 的运营备注`} /></div><div className="shortlist-actions"><button className="btn btn-outline" onClick={() => onOpenCalc(product)}><Calculator size={15} />测算</button><a className="btn btn-outline" href={product.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />源站</a><button className="btn btn-outline danger" onClick={() => onToggleShortlist(product)}><Trash2 size={15} />移除</button></div></article>)}</div>}</div>;
}
