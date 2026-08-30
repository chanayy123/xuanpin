import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync("products_raw.json", "utf-8"));
const products = rawData.products || [];

console.log(`Total Products: ${products.length}`);

// Category Distribution
const categories = {};
const materials = {};
const priceTiers = {
  "0-10元": 0,
  "10-20元": 0,
  "20-50元": 0,
  "50元以上": 0
};

products.forEach(p => {
  const cat = p.categoryName || "未分类";
  categories[cat] = (categories[cat] || 0) + 1;

  const title = p.goodsTitle || p.title || "";
  if (title.includes("涤纶")) materials["涤纶 (Polyester)"] = (materials["涤纶 (Polyester)"] || 0) + 1;
  else if (title.includes("木")) materials["木制/竹木 (Wood)"] = (materials["木制/竹木 (Wood)"] || 0) + 1;
  else if (title.includes("金属") || title.includes("马口铁")) materials["金属/马口铁 (Metal)"] = (materials["金属/马口铁 (Metal)"] || 0) + 1;
  else if (title.includes("帆布")) materials["帆布 (Canvas)"] = (materials["帆布 (Canvas)"] || 0) + 1;
  else if (title.includes("亚麻")) materials["亚麻 (Linen)"] = (materials["亚麻 (Linen)"] || 0) + 1;
  else if (title.includes("超细纤维")) materials["超细纤维 (Microfiber)"] = (materials["超细纤维 (Microfiber)"] || 0) + 1;
  else if (title.includes("橡胶")) materials["橡胶 (Rubber)"] = (materials["橡胶 (Rubber)"] || 0) + 1;
  else if (title.includes("亚克力")) materials["亚克力 (Acrylic)"] = (materials["亚克力 (Acrylic)"] || 0) + 1;
  else materials["其他/复合材质"] = (materials["其他/复合材质"] || 0) + 1;

  const price = p.minPrice || p.price || 0;
  if (price < 10) priceTiers["0-10元"]++;
  else if (price < 20) priceTiers["10-20元"]++;
  else if (price < 50) priceTiers["20-50元"]++;
  else priceTiers["50元以上"]++;
});

console.log("Categories:", JSON.stringify(categories, null, 2));
console.log("Materials:", JSON.stringify(materials, null, 2));
console.log("Price Tiers:", JSON.stringify(priceTiers, null, 2));
