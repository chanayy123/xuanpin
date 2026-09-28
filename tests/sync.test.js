import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fetchAllGoods, fetchJsonWithRetry, runSync, sanitizeEvidence } from '../scripts/sync_catalog.js';
import { runDailyPipeline } from '../scripts/daily_pipeline.js';
import { createDashboardServer } from '../scripts/serve_dist.js';

test('分页 total 变化不会被当作完整快照发布', async () => {
  let calls = 0;
  await assert.rejects(() => fetchAllGoods(async () => ({ data: { total: ++calls === 1 ? 3 : 4, records: [{ goodsId: calls }] } }), 'https://example.test/api', 1), /分页总数变化/);
});

test('公开响应证据递归移除敏感字段而保留供货资料', () => {
  assert.deepEqual(sanitizeEvidence({ data: { goodsId: 2, skus: [{ price: 5, accessToken: 'secret' }], email: 'private' } }), { data: { goodsId: 2, skus: [{ price: 5, accessToken: '[REDACTED]' }], email: '[REDACTED]' } });
});

test('401/403/429立即停止本轮，不进行快速重试', async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    let waits = 0;
    await assert.rejects(() => fetchJsonWithRetry('https://example.test/api', async () => {
      calls += 1;
      return { ok: false, status, statusText: 'Unavailable' };
    }, 3, async () => { waits += 1; }), (error) => error.stopSync && error.message.includes(String(status)));
    assert.equal(calls, 1);
    assert.equal(waits, 0);
  }
});

test('详情对应错误商品时不覆盖上次目录', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xuanpin-detail-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
  const original = JSON.stringify({ sourceTotal: 1, products: [], catalogHash: 'last-good' });
  fs.writeFileSync(path.join(root, 'public/data/catalog.json'), original);
  const fetchJson = async (url) => url.includes('/category/') ? { data: [] }
    : url.includes('/page?') ? { data: { total: 1, records: [{ goodsId: 1 }] } }
      : { data: { goodsId: 2 } };
  await assert.rejects(() => runSync({ rootDir: root, fetchJson }), /详情抓取失败率/);
  assert.equal(fs.readFileSync(path.join(root, 'public/data/catalog.json'), 'utf8'), original);
});

test('派生排名失败回滚所有数据并发布可见失败信息', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xuanpin-fallback-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
  const good = JSON.stringify({ catalogHash: 'known-good', products: [{ id: '1' }] });
  fs.writeFileSync(path.join(root, 'public/data/catalog.json'), good);
  fs.writeFileSync(path.join(root, 'public/data/sync-meta.json'), JSON.stringify({ lastSuccessAt: '2026-09-20T00:00:00Z' }));
  const stagesRun = [];
  const result = await runDailyPipeline({ root, stages: [['sync', []], ['rank', []], ['build', []]], execute: async (stage) => {
    stagesRun.push(stage);
    if (stage === 'sync') fs.writeFileSync(path.join(root, 'public/data/catalog.json'), '{"catalogHash":"new-but-unvalidated"}');
    if (stage === 'rank') throw new Error('rank is incomplete');
  } });
  assert.equal(result.success, false);
  assert.equal(fs.readFileSync(path.join(root, 'public/data/catalog.json'), 'utf8'), good);
  const status = JSON.parse(fs.readFileSync(path.join(root, 'public/data/daily-sync.json')));
  assert.equal(status.status, 'failed');
  assert.equal(status.failureStage, 'rank');
  assert.equal(status.catalogHash, 'known-good');
  assert.equal(status.lastSuccessAt, '2026-09-20T00:00:00Z');
  assert.equal(status.servingLastKnownGood, true);
  assert.deepEqual(stagesRun, ['sync', 'rank', 'fallback-build']);
});

test('公开源证据文件的 SHA256 与 manifest 一致', () => {
  const base = new URL('../data/source/latest/', import.meta.url);
  if (!fs.existsSync(new URL('manifest.json', base))) return;
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', base)));
  assert.equal(manifest.files.filter((row) => row.filename.startsWith('goods-detail')).length, manifest.sourceTotal - manifest.detailFailures);
  for (const row of manifest.files) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(row.filename, base))).digest('hex'), row.sha256);
});

test('本地服务切换完整版本且缺失JSON返回404', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xuanpin-server-test-'));
  fs.mkdirSync(path.join(root, 'versions/a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'versions/b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'versions/a/index.html'), 'version a');
  fs.writeFileSync(path.join(root, 'versions/b/index.html'), 'version b');
  fs.mkdirSync(path.join(root, 'versions/a/assets'));
  fs.writeFileSync(path.join(root, 'versions/a/assets/old-hash.js'), 'old asset');
  fs.writeFileSync(path.join(root, 'current.json'), JSON.stringify({ directory: 'versions/a', runId: 'a' }));
  const server = createDashboardServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base)).text(), 'version a');
  fs.writeFileSync(path.join(root, 'current.json'), JSON.stringify({ directory: 'versions/b', runId: 'b' }));
  assert.equal(await (await fetch(base)).text(), 'version b');
  assert.equal(await (await fetch(`${base}/assets/old-hash.js`)).text(), 'old asset');
  assert.equal((await fetch(`${base}/data/missing.json`)).status, 404);
  const status = await (await fetch(`${base}/__dashboard/status.json`)).json();
  assert.equal(status.buildVersion, 'b');
});
