import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };
const readJson = (filename, fallback = {}) => { try { return JSON.parse(fs.readFileSync(filename, 'utf8')); } catch { return fallback; } };
export function activeRoot(root) {
  const current = readJson(path.join(root, 'current.json'));
  const selected = current.directory ? path.resolve(root, current.directory) : root;
  if (selected !== root && !selected.startsWith(`${root}${path.sep}`)) throw new Error('Invalid build directory');
  return selected;
}
export function createDashboardServer(root) {
  root = path.resolve(root);
  return http.createServer((request, response) => {
    let filePath;
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      if (pathname === '/__dashboard/status.json') {
        const current = readJson(path.join(root, 'current.json'));
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ server: 'xuanpin-local', buildVersion: current.runId || null, ...readJson(path.join(root, 'update-status.json')) }));
        return;
      }
      const selectedRoot = activeRoot(root);
      filePath = path.resolve(selectedRoot, path.normalize(pathname).replace(/^[/\\]+/, '') || 'index.html');
      if (filePath !== selectedRoot && !filePath.startsWith(`${selectedRoot}${path.sep}`)) { response.writeHead(403).end('Forbidden'); return; }
      // A page opened just before a version switch may still request its old hashed asset.
      if (!fs.existsSync(filePath) && pathname.startsWith('/assets/') && path.basename(pathname) === pathname.slice('/assets/'.length)) {
        const versions = path.join(root, 'versions');
        if (fs.existsSync(versions)) {
          const match = fs.readdirSync(versions, { withFileTypes: true }).filter((entry) => entry.isDirectory())
            .map((entry) => path.join(versions, entry.name, 'assets', path.basename(pathname))).find((candidate) => fs.existsSync(candidate));
          if (match) filePath = match;
        }
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
      if (!fs.existsSync(filePath) && !path.extname(pathname)) filePath = path.join(selectedRoot, 'index.html');
    } catch { response.writeHead(400).end('Bad request'); return; }
    fs.readFile(filePath, (error, content) => {
      if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Unable to load dashboard'); return; }
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(content);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] || 'dist');
  const port = Number(process.argv[3] || 4173);
  const server = createDashboardServer(root);
  server.listen(port, '127.0.0.1', () => console.log(`Selection dashboard: http://127.0.0.1:${port}/`));
  if (process.platform === 'win32' && process.argv.includes('--auto-update')) {
    let updating = false;
    const timer = setInterval(() => {
      if (updating) return;
      updating = true;
      const launcher = path.join(path.dirname(fileURLToPath(import.meta.url)), 'start_latest_dashboard.ps1');
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher, '-UpdateOnly', '-NoOpen'], { windowsHide: true, stdio: 'inherit', timeout: 5 * 60 * 1000 });
      child.once('error', (error) => { updating = false; console.error(error.message); });
      child.once('exit', () => { updating = false; });
    }, 60 * 60 * 1000);
    timer.unref();
  }
}
