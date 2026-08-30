import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync("products_raw.json", "utf-8"));
const sample = rawData.products.slice(0, 3);
console.log(JSON.stringify(sample, null, 2));
