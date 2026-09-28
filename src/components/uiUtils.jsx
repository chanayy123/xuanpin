import React, { useEffect, useState } from 'react';
import { PackageOpen } from 'lucide-react';
export const displayDate = (value, full = false) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('zh-CN', full ? { hour12: false } : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '暂无记录';
export const numberText = (value, digits = 1) => Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: digits }) : '—';
export const downloadText = (filename, content, mime = 'text/plain;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const csvCell = (value) => `"${String(value ?? '').replace(/^[=+@\-]/, "'$&").replaceAll('"', '""')}"`;
export function ProductImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img className={className} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span className={`no-image ${className}`} role="img" aria-label={alt ? `${alt}：图片暂不可用` : '图片暂不可用'}><PackageOpen size={22} strokeWidth={1.3} /><small>{src ? '图片暂不可用' : '暂无图片'}</small></span>;
}
