# Temu 市场搜索源基准测试

当前目标：比较 Firecrawl / Tavily / Exa 对 Temu 同类商品的发现覆盖率和可用证据，不把搜索摘要当作实时 Temu 价格。

## 当前状态

- Firecrawl：支持 Keyless，可直接测试，不需要注册。
- Tavily：可选；设置 `TAVILY_API_KEY` 后参与测试。
- Exa：可选；设置 `EXA_API_KEY` 后参与测试。

## 本地运行

```bash
node scripts/benchmark_market_sources.js
```

默认仅运行 Firecrawl。

三家一起跑：

```bash
BENCHMARK_PROVIDERS=firecrawl,tavily,exa \
TAVILY_API_KEY=... \
EXA_API_KEY=... \
node scripts/benchmark_market_sources.js
```

Windows PowerShell：

```powershell
$env:BENCHMARK_PROVIDERS='firecrawl,tavily,exa'
$env:TAVILY_API_KEY='...'
$env:EXA_API_KEY='...'
node scripts/benchmark_market_sources.js
```

结果输出：

```text
data/benchmarks/market-source-latest.json
```

## GitHub Actions

工作流：`Benchmark Temu market sources`

默认只跑 Firecrawl Keyless。以后如需测试 Tavily / Exa，在仓库 Secrets 添加：

- `TAVILY_API_KEY`
- `EXA_API_KEY`

然后手动运行 workflow，把 providers 改为：

```text
firecrawl,tavily,exa
```

## 判定原则

第一阶段只比较：

1. 是否找到真实 Temu 商品 URL。
2. 同类商品命中数量。
3. 标题/摘要是否和源商品属于同一商品类型。
4. 是否能返回价格、销量、评价等有用证据。
5. 同一商品人工打开 Temu 后，与搜索证据的偏差和新鲜度。
6. 每次查询消耗的免费额度。

搜索结果只能作为市场证据；关键价格和最终核价判断仍需单独验证。
