import React from 'react';
import { Calculator, ClipboardCheck, ListChecks, PackageSearch, ShieldCheck, Star } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, shortlistCount, syncMeta, stale, openMethod, openCalc }) {
  const items = [
    { id: 'catalog', name: '全量商品目录', icon: PackageSearch },
    { id: 'priority', name: '优先测款候选', icon: Star },
    { id: 'shortlist', name: '内部测款清单', icon: ListChecks, count: shortlistCount },
  ];
  return (
    <aside className="app-sidebar">
      <div>
        <p className="sidebar-label">选品工作区</p>
        <nav className="sidebar-nav">
          {items.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => setActiveTab(item.id)}><span><Icon size={18} />{item.name}</span>{item.count > 0 && <b>{item.count}</b>}</button>;
          })}
        </nav>
        <p className="sidebar-label tools-label">决策工具</p>
        <div className="sidebar-tools">
          <button onClick={openMethod}><ClipboardCheck size={17} />评分与证据说明</button>
          <button onClick={openCalc}><Calculator size={17} />全成本情景测算</button>
        </div>
      </div>
      <div className={`sidebar-status card-glass ${stale ? 'stale' : ''}`}>
        <div><ShieldCheck size={17} /><strong>{stale ? '同步状态异常' : '目录同步正常'}</strong></div>
        <p>最近成功</p>
        <time>{new Date(syncMeta.lastSuccessAt).toLocaleString('zh-CN', { hour12: false })}</time>
        <p>详情成功率</p>
        <strong>{syncMeta.detailSuccess}/{syncMeta.sourceTotal}</strong>
      </div>
    </aside>
  );
}
