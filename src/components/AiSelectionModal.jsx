import React from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, X } from 'lucide-react';

const dimensions = [
  ['数据完整度', '15 分', '价格、重量、尺寸、类目、材质/工艺、时效与 SKU'],
  ['物流适配', '20 分', '按最重 SKU 的实际重量与体积重较大值分档'],
  ['发货时效', '15 分', '24 小时 15 分，48 小时 10 分，其他 5 分'],
  ['低成本测款', '15 分', '最低供货价越低，试错成本分越高'],
  ['POD/差异化', '20 分', '依据定制标记、工艺、材质与合理的 SKU 变体'],
  ['合规与售后', '15 分', '烟具强制复核；易碎、大件和高重量扣分'],
];

export default function AiSelectionModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return <div className="modal-overlay" onClick={onClose}><div className="modal-content method-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20} /></button><div className="modal-heading-icon"><ClipboardCheck size={23} /></div><h2>测款评分与证据标准</h2><p className="modal-lead">这不是 AI 爆款预测。分数只表达当前商品在供货、物流和运营测试层面的可执行性，不代表市场销量或最终利润。</p><div className="method-grid">{dimensions.map(([name, score, description]) => <div className="method-item" key={name}><strong>{score}</strong><div><h3>{name}</h3><p>{description}</p></div></div>)}</div><div className="status-rules"><h3>状态门槛</h3><p><span className="badge badge-emerald">可优先测款</span> ≥75 且无合规拦截</p><p><span className="badge badge-cyan">普通测款</span> 60–74</p><p><span className="badge badge-amber">谨慎评估</span> &lt;60 或关键数据缺失</p><p><span className="badge badge-rose">合规复核</span> 受限类目，不进入推荐榜</p></div><div className="evidence-policy"><CheckCircle2 size={18} /><div><strong>可信数据才参与判断</strong><p>市场证据必须包含来源 URL、采集时间、样本数和原始样本。当前没有授权数据源，因此市场价、销量、竞争度和确定性利润均显示为空。</p></div></div><div className="warning-policy"><AlertTriangle size={18} />运营评分高也只表示“值得进入测款流程”，不能直接替代样品检查、合规审核和真实市场测试。</div></div></div>;
}
