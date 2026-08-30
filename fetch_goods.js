import fs from 'fs';

async function fetchProducts() {
  const urls = [
    "https://taojinchuhai.cn/api/merchant/selection/goods/page?pageNo=1&pageSize=100",
    "https://taojinchuhai.cn/merchant/selection/goods/page?pageNo=1&pageSize=100",
    "https://taojinchuhai.cn/api/merchant/selection/category/tree",
    "https://taojinchuhai.cn/merchant/selection/category/tree"
  ];

  for (const url of urls) {
    try {
      console.log("Fetching:", url);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*"
        }
      });
      console.log("Status:", res.status, res.statusText);
      if (res.ok) {
        const data = await res.json();
        console.log("Data snippet:", JSON.stringify(data).substring(0, 300));
        fs.writeFileSync("test_response.json", JSON.stringify(data, null, 2), "utf-8");
        break;
      }
    } catch (err) {
      console.error("Error fetching", url, err.message);
    }
  }
}

fetchProducts();
