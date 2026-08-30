# 历史数据说明

仓库根目录中的旧 CSV、Markdown、`products_raw.json`、`temu_real_scraped_data.json` 与 `temu_selection_dashboard.html` 均为 **2026-08-12 历史快照**，仅用于审计和回归测试。

这些文件不再作为当前商品目录、市场销量或选品结论。当前权威数据由 `npm run sync` 生成到 `public/data/`：

- `catalog.json`：规范化商品目录与测款评估；
- `sync-meta.json`：最近同步状态；
- `products.csv`：由规范化目录生成的导出；
- `selection-report.md`：由同一目录生成的可审计报告。

当前没有可信 Temu 市场数据源，因此系统不会生成或展示未经验证的售价、销量、竞争度和确定性利润。
