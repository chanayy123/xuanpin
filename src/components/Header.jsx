import React from 'react';
import { ArrowUpRight, Compass, RefreshCw, Search } from 'lucide-react';

export default function Header({ searchQuery, setSearchQuery, shortlistCount, setActiveTab, stale, syncFailed, onRefresh, refreshing, activeTab }) {
  return <header className="app-header">
    <button className="brand-block" onClick={() => setActiveTab('ranking')} aria-label="返回品类排名首页"><span className="brand-mark"><Compass size={23} strokeWidth={1.7} /></span><span><span className="brand-title">淘金选品<span className="brand-version">工作台</span></span><span className="brand-subtitle">INTERNAL RESEARCH & SOURCING</span></span></button>
    <div className="header-search"><Search size={17} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activeTab === 'catalog' ? '搜索商品、材质、工艺或 ID…' : '搜索品类、推荐依据或风险…'} aria-label={activeTab === 'catalog' ? '搜索商品' : '搜索品类'} />{searchQuery && <button onClick={() => setSearchQuery('')} aria-label="清空搜索">×</button>}</div>
    <div className="header-actions"><button className={`sync-chip ${stale || syncFailed ? 'is-stale' : ''}`} onClick={() => setActiveTab('evidence')}><span className="status-dot" />{syncFailed ? '本轮同步失败' : stale ? '供货快照待更新' : '供货快照已更新'}</button><button className="icon-button btn btn-outline" onClick={onRefresh} disabled={refreshing} title="重新读取站点已生成的数据，不触发源站采集" aria-label="刷新站点数据"><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button><button className="btn btn-primary header-shortlist" onClick={() => setActiveTab('shortlist')}>测款清单 <span>{shortlistCount}</span><ArrowUpRight size={15} /></button></div>
  </header>;
}
