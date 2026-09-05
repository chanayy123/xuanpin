import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'benchmarks', 'brightdata-temu-probe');
const API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;

if (!API_TOKEN) throw new Error('BRIGHTDATA_API_TOKEN is not configured');

const ENDPOINT = `https://mcp.brightdata.com/mcp?token=${encodeURIComponent(API_TOKEN)}&groups=browser`;
const TARGET_URL = 'https://www.temu.com/search_result.html?search_key=floral+throw+pillow+covers&search_method=user';

let sessionId = null;
let requestId = 1;

function parseBody(text, contentType) {
  if (!text) return null;
  if (contentType.includes('text/event-stream')) {
    const messages = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { messages.push(JSON.parse(data)); } catch {}
    }
    return messages.length === 1 ? messages[0] : messages;
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function rpc(method, params = {}, { notification = false } = {}) {
  const id = notification ? undefined : requestId++;
  const body = { jsonrpc: '2.0', method, params };
  if (!notification) body.id = id;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = response.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await response.text();
  const parsed = parseBody(text, response.headers.get('content-type') || '');

  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed.slice(0, 800) : JSON.stringify(parsed).slice(0, 800);
    throw new Error(`${method} failed: HTTP ${response.status} ${detail}`);
  }
  if (notification) return parsed;

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const match = messages.find((m) => m && m.id === id) || messages.find(Boolean);
  if (match?.error) throw new Error(`${method} MCP error: ${JSON.stringify(match.error)}`);
  return match?.result ?? match;
}

function resultText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result.content)) {
    return result.content
      .filter((item) => item?.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n');
  }
  return JSON.stringify(result);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const output = {
    startedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    mode: 'Bright Data MCP groups=browser',
    tools: [],
    steps: [],
  };

  try {
    const init = await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      clientInfo: { name: 'xuanpin-brightdata-browser-probe', version: '1.0.0' },
    });
    await rpc('notifications/initialized', {}, { notification: true });
    output.serverInfo = init?.serverInfo || null;

    const toolsResult = await rpc('tools/list');
    const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
    output.tools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      inputProperties: Object.keys(tool.inputSchema?.properties || {}),
      required: tool.inputSchema?.required || [],
    }));

    const names = new Set(tools.map((tool) => tool.name));
    const navigateName = ['scraping_browser_navigate', 'scraping_browser_go'].find((name) => names.has(name));
    const snapshotName = ['scraping_browser_snapshot', 'scraping_browser_get_text'].find((name) => names.has(name));
    const networkName = 'scraping_browser_network_requests';

    if (!navigateName) {
      output.steps.push({ step: 'navigate', ok: false, error: 'No browser navigation tool exposed' });
    } else {
      try {
        const result = await rpc('tools/call', { name: navigateName, arguments: { url: TARGET_URL } });
        output.steps.push({ step: 'navigate', tool: navigateName, ok: true, preview: resultText(result).slice(0, 2500) });
      } catch (error) {
        output.steps.push({ step: 'navigate', tool: navigateName, ok: false, error: error.message });
      }
    }

    if (snapshotName) {
      try {
        const result = await rpc('tools/call', { name: snapshotName, arguments: {} });
        const text = resultText(result);
        output.steps.push({
          step: 'snapshot',
          tool: snapshotName,
          ok: true,
          chars: text.length,
          priceSignalCount: (text.match(/\$\s*\d+(?:\.\d{1,2})?/g) || []).length,
          soldSignalCount: (text.match(/\b\d+(?:[.,]\d+)?\s*[kKmM]?\+?\s*sold\b/gi) || []).length,
          reviewSignalCount: (text.match(/\b\d[.,\d]*\s+reviews?\b/gi) || []).length,
          preview: text.slice(0, 5000),
        });
      } catch (error) {
        output.steps.push({ step: 'snapshot', tool: snapshotName, ok: false, error: error.message });
      }
    }

    if (names.has(networkName)) {
      try {
        const result = await rpc('tools/call', { name: networkName, arguments: {} });
        const text = resultText(result);
        output.steps.push({ step: 'network', tool: networkName, ok: true, chars: text.length, preview: text.slice(0, 5000) });
      } catch (error) {
        output.steps.push({ step: 'network', tool: networkName, ok: false, error: error.message });
      }
    }
  } catch (error) {
    output.fatalError = error.message;
  }

  output.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'latest-browser.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({
    tools: output.tools.map((tool) => tool.name),
    steps: output.steps.map(({ step, tool, ok, error, chars, priceSignalCount, soldSignalCount, reviewSignalCount }) => ({
      step, tool, ok, error, chars, priceSignalCount, soldSignalCount, reviewSignalCount,
    })),
    fatalError: output.fatalError || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
