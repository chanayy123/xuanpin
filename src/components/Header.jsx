import React from 'react';
import { Calculator, ClipboardCheck, Compass, Moon, Search, Sun } from 'lucide-react';

export default function Header({ searchQuery, setSearchQuery, isDarkMode, setIsDarkMode, openMethod, openCalc, shortlistCount, setActiveTab, syncMeta, stale }) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <div className="brand-mark"><Compass size={23} /></div>
        <div>
          <div className="brand-title">淘金选品决策台 <span className="badge badge-emerald">真实目录</span></div>
          <div className="brand-subtitle">内部运营 · 数据可追溯 · 规则可解释</div>
        </div>
      </div>
      <div className="header-search">
        <Search size={17} />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索商品名称、ID、类目、材质或工艺" aria-label="搜索商品" />
        {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="清空搜索">×</button>}
      </div>
      <div className="header-actions">
        <div className={`sync-chip ${stale ? 'is-stale' : ''}`} title={syncMeta.lastSuccessAt}>
          <span className="status-dot" />{stale ? '数据已过期' : `${syncMeta.sourceTotal} 款已同步`}
        </div>
        <button className="btn btn-secondary" onClick={openMethod}><ClipboardCheck size={16} />评分说明</button>
        <button className="btn btn-secondary" onClick={openCalc}><Calculator size={16} />情景测算</button>
        <button className="btn btn-outline shortlist-button" onClick={() => setActiveTab('shortlist')}>测款清单 <span>{shortlistCount}</span></button>
        <button className="btn btn-outline icon-button" onClick={() => setIsDarkMode(!isDarkMode)} aria-label="切换主题">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
      </div>
    </header>
  );
}
