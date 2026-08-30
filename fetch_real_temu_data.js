console.error('已停用：当前没有获得授权且可复核的 Temu 市场数据源。系统不会再用随机数或固定值补齐售价、销量和竞争度。');
console.error('如后续接入可信来源，必须提供来源 URL、采集时间、样本数和原始样本，再写入 MarketEvidence。');
process.exitCode = 1;
