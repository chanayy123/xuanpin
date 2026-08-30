import React from 'react';
import { 
  Grid, 
  TrendingUp, 
  Factory, 
  Sparkles, 
  Calculator, 
  Send, 
  Heart, 
  Globe2,
  PackageCheck,
  Building2,
  Warehouse
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, openAiModal, openCalcModal, favoritesCount, listingCount }) {
  const navItems = [
    { id: 'selection', name: '商家选品大厅', icon: Grid, badge: 'HOT' },
    { id: 'viral', name: '爆款趋势榜', icon: TrendingUp, badge: '实时' },
    { id: 'factory', name: '源头工厂直供', icon: Factory },
    { id: 'listing', name: '一键刊登工作台', icon: Send, count: listingCount },
    { id: 'favorites', name: '我的选品库', icon: Heart, count: favoritesCount }
  ];

  return (
    <aside style={{
      width: '240px',
      backgroundColor: 'var(--bg-dark-card)',
      borderRight: '1px solid var(--border-dark)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '20px 14px',
      minHeight: 'calc(100vh - 70px)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Main Navigation Menu */}
        <div>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            color: 'var(--text-dark-dim)',
            padding: '0 12px 10px 12px',
            letterSpacing: '0.05em'
          }}>
            选品与运营中心
          </p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'var(--bg-dark-hover)' : 'transparent',
                    border: isActive ? '1px solid var(--border-dark-bright)' : '1px solid transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-dark-muted)',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Icon size={18} style={{ color: isActive ? 'var(--primary)' : 'currentColor' }} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span style={{
                      backgroundColor: 'var(--primary-glow)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold'
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Tools Section */}
        <div>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            color: 'var(--text-dark-dim)',
            padding: '0 12px 10px 12px',
            letterSpacing: '0.05em'
          }}>
            出海数字工具箱
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-purple" 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              onClick={openAiModal}
            >
              <Sparkles size={16} />
              <span>AI 爆款生成灵感</span>
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              onClick={openCalcModal}
            >
              <Calculator size={16} />
              <span>全成本利润测算器</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Status Card Footer */}
      <div className="card-glass" style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-dark-base)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Warehouse size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-dark-main)' }}>海外仓实时网络</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dark-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>美东/美西仓:</span>
            <b style={{ color: '#34d399' }}>正常调配 (14仓)</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>欧洲/日本仓:</span>
            <b style={{ color: '#38bdf8' }}>直发在途 (8仓)</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>源头工厂:</span>
            <b style={{ color: '#fbbf24' }}>1,820+ 家已认证</b>
          </div>
        </div>
      </div>
    </aside>
  );
}
