import React from 'react';
import { 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Trash2,
  Store,
  Layers,
  Sparkles
} from 'lucide-react';

export default function ListingWorkbench({ listingTasks, onRemoveTask }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner Overview */}
      <div className="card-glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="badge badge-purple">1-Click Cross-Border Sync</span>
            <span className="badge badge-emerald">自动多语言API匹配</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>
            一键刊登与铺货工作台看板
          </h2>
          <p style={{ color: 'var(--text-dark-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            监控推送至 TikTok Shop、Amazon FBA、Temu 及 Shopee 店铺的商品上架进度及刊登日志。
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="card-glass" style={{ padding: '12px 20px', textAlign: 'center', background: 'var(--bg-dark-base)' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)' }}>{listingTasks.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>累计刊登任务</div>
          </div>

          <div className="card-glass" style={{ padding: '12px 20px', textAlign: 'center', background: 'var(--bg-dark-base)' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>98.4%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>API成功率</div>
          </div>
        </div>
      </div>

      {/* Task List Table */}
      <div className="card-glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-dark-main)' }}>
            当前刊登任务队列 ({listingTasks.length})
          </span>
        </div>

        {listingTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dark-dim)' }}>
            <Send size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ fontSize: '0.95rem' }}>暂无正在刊登的任务，快去「选品大厅」挑选高毛利爆款铺货吧！</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-dark)', color: 'var(--text-dark-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>商品信息</th>
                  <th style={{ padding: '12px 14px' }}>目标店铺</th>
                  <th style={{ padding: '12px 14px' }}>上架售价</th>
                  <th style={{ padding: '12px 14px' }}>同步状态</th>
                  <th style={{ padding: '12px 14px' }}>创建时间</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {listingTasks.map((task) => (
                  <tr key={task.taskId} style={{ borderBottom: '1px solid var(--border-dark)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={task.product.image} alt={task.product.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark-main)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.product.title}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dark-dim)' }}>ID: {task.product.id}</span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px' }}>
                      <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Store size={12} />
                        {task.store}
                      </span>
                    </td>

                    <td style={{ padding: '14px', fontWeight: '700', color: 'var(--accent-gold)' }}>
                      ${task.price} USD
                    </td>

                    <td style={{ padding: '14px' }}>
                      {task.status === '刊登成功' ? (
                        <span className="badge badge-emerald">
                          <CheckCircle2 size={12} /> 刊登成功 (已上架)
                        </span>
                      ) : (
                        <span className="badge badge-amber">
                          <Clock size={12} /> 正在跨境API同步中...
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px', color: 'var(--text-dark-dim)', fontSize: '0.8rem' }}>
                      {task.timestamp}
                    </td>

                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button 
                        onClick={() => onRemoveTask(task.taskId)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-dark-dim)', cursor: 'pointer', padding: '6px' }}
                        title="删除记录"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
