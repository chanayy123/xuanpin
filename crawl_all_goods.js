import fs from 'fs';
import path from 'path';

const BASE_URL = "https://taojinchuhai.cn/api";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*"
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return await res.json();
}

async function main() {
  console.log("=== 正在从 taojinchuhai.cn 抓取全量商品数据 ===");

  // 1. Fetch Categories
  let categories = [];
  try {
    const catRes = await fetchJson(`${BASE_URL}/merchant/selection/category/tree`);
    categories = catRes.data || [];
    console.log(`成功获取类目树: ${categories.length} 个大类`);
  } catch (err) {
    console.error("获取类目失败:", err.message);
  }

  // 2. Fetch All Goods Page List
  console.log("正在请求商品列表页面数据 (pageSize=100)...");
  const listRes = await fetchJson(`${BASE_URL}/merchant/selection/goods/page?pageNo=1&pageSize=100`);
  
  const total = listRes.data?.total || 0;
  const records = listRes.data?.records || [];
  console.log(`查询到平台共有 ${total} 款在售/选品商品 (当前获取 ${records.length} 条)`);

  // 3. Fetch Details for Each Product
  const fullProducts = [];
  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    console.log(`[${i + 1}/${records.length}] 正在获取商品详情: ID ${item.goodsId} - ${item.goodsTitle || item.title}`);
    try {
      const detailRes = await fetchJson(`${BASE_URL}/goods/${item.goodsId}/detail`);
      const detailData = detailRes.data || {};
      fullProducts.push({
        ...item,
        detail: detailData
      });
    } catch (err) {
      console.warn(`⚠️ 获取商品 ${item.goodsId} 详情失败: ${err.message}，使用基础信息。`);
      fullProducts.push(item);
    }
    // Subtle pause to respect server
    await new Promise(r => setTimeout(r, 100));
  }

  // 4. Save Raw JSON
  fs.writeFileSync("products_raw.json", JSON.stringify({ total, categories, products: fullProducts }, null, 2), "utf-8");
  console.log("✅ 原始数据已保存至 d:\\project\\xuanpin\\products_raw.json");

  // 5. Generate CSV File
  const csvHeaders = [
    "GoodsID", "GoodsTitle", "Category", "SubCategory", "PriceCNY", "RetailPriceUSD",
    "DeliveryTimeDays", "WeightKg", "StockCount", "FactoryName", "Certifications",
    "SkuCount", "CoverImageUrl", "CreatedAt"
  ];

  const escapeCsv = (str) => {
    if (str == null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const csvRows = [csvHeaders.join(",")];

  fullProducts.forEach(p => {
    const d = p.detail || {};
    const skus = d.skuList || p.skuList || [];
    const minPrice = p.minPrice || p.price || p.priceCny || d.minPrice || 0;
    const retailUsd = p.retailPrice || d.suggestedRetailPrice || p.suggestedPrice || 0;
    const delivery = p.deliveryTime || d.deliveryTime || p.deliveryDays || "24-48小时";
    const weight = p.weight || d.weight || 0;
    const stock = p.stock || d.stock || 0;
    const factory = p.factoryName || d.factoryName || p.supplier || "源头工厂认证";
    const certs = (p.certifications || d.certifications || []).join("; ");
    const cat = p.categoryName || d.categoryName || "普通选品";
    const subCat = p.subCategoryName || d.subCategoryName || "";

    const row = [
      p.goodsId,
      escapeCsv(p.goodsTitle || p.title || ""),
      escapeCsv(cat),
      escapeCsv(subCat),
      minPrice,
      retailUsd,
      escapeCsv(delivery),
      weight,
      stock,
      escapeCsv(factory),
      escapeCsv(certs),
      skus.length,
      escapeCsv(p.coverImageUrl || p.coverImage || ""),
      escapeCsv(p.createTime || p.createdAt || "")
    ];
    csvRows.push(row.join(","));
  });

  fs.writeFileSync("products_list.csv", "\uFEFF" + csvRows.join("\n"), "utf-8"); // BOM for Excel UTF-8
  console.log("✅ CSV 格式明细表已保存至 d:\\project\\xuanpin\\products_list.csv");
}

main().catch(err => console.error("Fatal Error:", err));
