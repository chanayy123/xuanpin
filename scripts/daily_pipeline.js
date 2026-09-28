import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUTS = ['public/data', 'data/history.json', 'data/source/latest'];
const readJson = (filename, fallback = {}) => { try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return fallback; } };

export function writeDailyStatus(root, { startedAt, failureStage = null, error = null, previous = {} }) {
  const sync = readJson(path.join(root, 'public/data/sync-meta.json'));
  const catalog = readJson(path.join(root, 'public/data/catalog.json'));
  const completedAt = new Date().toISOString();
  const status = {
    schemaVersion: 1, status: failureStage ? 'failed' : 'success', startedAt, completedAt,
    lastSuccessAt: failureStage ? (previous.lastSuccessAt || sync.lastSuccessAt || null) : completedAt,
    failureStage, error, servingLastKnownGood: Boolean(failureStage),
    catalogHash: catalog.catalogHash || null,
    catalogObservedAt: sync.lastSuccessAt || catalog.generatedAt || null,
    schedule: {
      provider: 'github-actions', timezone: 'Asia/Shanghai', localTime: '08:15', cronUtc: '15 0 * * *',
      active: process.env.DAILY_SCHEDULE_ACTIVE === 'true' || previous.schedule?.active === true,
      branch: 'feature/catalog-sync-dashboard',
      note: '计划每天北京时间 08:15，由默认分支触发应用分支；GitHub 调度可能延迟数小时。供货目录自动更新，市场证据保留原采集日期。',
      schedulerUrl: 'https://github.com/chanayy123/xuanpin/actions/workflows/sync-catalog.yml?query=branch%3Amaster',
      applicationUrl: 'https://github.com/chanayy123/xuanpin/actions/workflows/sync-catalog.yml?query=branch%3Afeature%2Fcatalog-sync-dashboard',
    },
    run: {
      id: process.env.GITHUB_RUN_ID || null,
      url: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
      event: process.env.GITHUB_EVENT_NAME || 'local',
    },
    sources: {
      supply: { automatic: true, name: '淘金出海公开目录' },
      market: { automatic: false, status: 'paused', reason: 'Temu 会话风控；THunt 销量口径未核实。' },
    },
  };
  fs.mkdirSync(path.join(root, 'public/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'public/data/daily-sync.json'), `${JSON.stringify(status, null, 2)}\n`);
  if (failureStage) fs.writeFileSync(path.join(root, 'public/data/sync-meta.json'), `${JSON.stringify({ ...sync, status: 'failed', lastAttemptAt: completedAt, error: `${failureStage}: ${error}` }, null, 2)}\n`);
  return status;
}

export async function runDailyPipeline({ root = ROOT, execute, stages } = {}) {
  const startedAt = new Date().toISOString();
  const previous = readJson(path.join(root, 'public/data/daily-sync.json'));
  fs.rmSync(path.join(root, 'dist/release.json'), { force: true });
  const backup = fs.mkdtempSync(path.join(os.tmpdir(), 'xuanpin-last-good-'));
  for (const relative of OUTPUTS) {
    const source = path.join(root, relative);
    if (fs.existsSync(source)) {
      fs.mkdirSync(path.dirname(path.join(backup, relative)), { recursive: true });
      fs.cpSync(source, path.join(backup, relative), { recursive: true });
    }
  }
  const commands = stages || [
    ['sync', ['scripts/sync_catalog.js']],
    ['screen', ['scripts/coarse_screen.js']],
    ['evidence', ['scripts/build_market_evidence.js']],
    ['rank', ['scripts/build_rankings.js']],
    ['test', ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter((name) => name.endsWith('.test.js')).map((name) => `tests/${name}`)]],
    ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ];
  const run = execute || ((_stage, args) => {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 12 * 60 * 1000, env: process.env });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`命令退出码 ${result.status ?? 'unknown'}`);
  });
  let failure = null;
  try {
    for (const [stage, args] of commands) {
      try {
        if (stage === 'build') writeDailyStatus(root, { startedAt, previous });
        await run(stage, args);
      } catch (error) {
        const sourceError = stage === 'sync' ? readJson(path.join(root, 'public/data/sync-meta.json')).error : null;
        failure = { stage, error: sourceError || error.message };
        break;
      }
    }
    if (failure) {
      for (const relative of OUTPUTS) {
        fs.rmSync(path.join(root, relative), { recursive: true, force: true });
        if (fs.existsSync(path.join(backup, relative))) {
          fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
          fs.cpSync(path.join(backup, relative), path.join(root, relative), { recursive: true });
        }
      }
      writeDailyStatus(root, { startedAt, previous, failureStage: failure.stage, error: failure.error });
      console.error(`每日同步 ${failure.stage} 失败，保留上次可用数据：${failure.error}`);
      const build = commands.find(([stage]) => stage === 'build');
      if (build) await run('fallback-build', build[1]);
    }
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/release.json'), `${JSON.stringify({ schemaVersion: 1, builtAt: new Date().toISOString(), runId: process.env.GITHUB_RUN_ID || null, commit: process.env.GITHUB_SHA || null, status: failure ? 'last-known-good' : 'success', failureStage: failure?.stage || null }, null, 2)}\n`);
    return { success: !failure, failure };
  } finally {
    fs.rmSync(backup, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runDailyPipeline().then((result) => { if (!result.success) process.exitCode = 1; }).catch((error) => { console.error(error); process.exitCode = 1; });
}
