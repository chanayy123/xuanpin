# 内部选品站：每日同步与 Windows 启动

双击根目录的 `启动最新版选品站.bat`。启动器下载应用分支最新有可用产物的已完成任务，在 `http://127.0.0.1:4173/` 打开站点。Node.js 20+ 和已登录的 GitHub CLI 是前提；仓库及构建产物继续保持现有访问权限。

## 每天更新什么

计划每天北京时间 **08:15**，默认分支 `master` 中的 `.github/workflows/sync-catalog.yml` 调度 `feature/catalog-sync-dashboard` 的同名工作流。GitHub 实际开始时间可能延迟数小时。主分支的工作流负责调度，新版应用保存在功能分支。

应用依次完成：公开供货目录 → 基础筛选 → 本地市场证据索引 → 品类排名 → 测试 → 构建 → 提交数据和保存站点产物。供货接口每个请求超时 20 秒、暂时网络错误最多重试 3 次、详情并发 3；HTTP 401/403/429 会停止本轮，等待下次任务。商品 ID、分页总数、覆盖量、数量大幅变化和详情失败率都会校验。

自动同步范围是淘金出海公开供货参数。Temu/THunt 历史资料保留实际采集日期，Temu 风控与 THunt 销量口径问题未解决，工作流不会访问它们；市场资料不会因为每日供货同步而变成“今日已验证”。

公开响应经敏感字段脱敏后存入 `data/source/latest/`，包含时间、URL 和 SHA256 清单；站点可读取 `public/data/source-evidence.json`。请求头、Cookie、浏览器会话和登录凭据不进入证据包。

## 失败时仍可参考上次数据

任一步失败会恢复上次可用的目录、排名与原始证据，再生成包含失败原因的站点。站内 `daily-sync.json` 和 `sync-meta.json` 显示失败环节、最近尝试和上次成功时间。若连备用站点也无法构建，本次不上传产物，启动器继续前一次版本，并显示最新任务未产生产物。

站点运行期间，本地服务器**每小时**检查一次 GitHub 构建。完整下载并校验后，以原子指针切换版本；下载失败保留旧版。重新双击启动器会立即检查一次，页面的本地更新提示可用于刷新至新版本。个人待测清单存于同一浏览器同一端口的 localStorage，更新不会清除它。

构建缓存保存在 `.local-build/versions/`，状态在 `.local-build/update-status.json`，日志在 `.local-build-server*.log`。服务器仅监听本机回环地址，不对局域网开放。旧版本缓存保留，便于排查；不会后台删除其他目录或终止未知进程。

## 维护命令

- `npm run daily`：在本机执行完整同步和构建，失败保留上次数据。
- `gh workflow run sync-catalog.yml --ref feature/catalog-sync-dashboard`：立即启动云端同步。
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start_latest_dashboard.ps1 -UpdateOnly`：只更新本地缓存。
- `scripts/config/daily-catalog-scheduler.yml`：部署到默认分支同名工作流的调度器模板；不要另建第二个定时工作流。

[应用同步运行记录](https://github.com/chanayy123/xuanpin/actions/workflows/sync-catalog.yml?query=branch%3Afeature%2Fcatalog-sync-dashboard) · [默认分支调度记录](https://github.com/chanayy123/xuanpin/actions/workflows/sync-catalog.yml?query=branch%3Amaster)
