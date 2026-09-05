import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'benchmarks', 'brightdata-temu-probe');
const API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;

if (!API_TOKEN) {
  throw new Error('BRIGHTDATA_API_TOKEN is not configured');
}

const ENDPOINT = `https://mcp.brightdata.com/mcp?token=${encodeURIComponent(API_TOKEN)}`;
const PROTOCOL_VERSIONS = ['2025-03-26', '2024-11-05'];

const SAMPLES = [
  { label: 'cosmetic-bag', query: 'cosmetic bag' },
  { label: 'drawstring-bag', query: 'drawstring bag' },
  { label: 'pillow-cover', query: 'floral throw pillow covers' },
  { label: 'folding-umbrella', query: 'automatic folding umbrella' },
  { label: 'garden-flag', query: 'garden flag' },
];

let sessionId = null;
let requestId = 1;

function parseResponseBody(text, contentType) {
  if (!text) return null;
  if (contentType.includes('text/event-stream')) {
    const events = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        events.push(JSON.parse(data));
      } catch {
        // Ignore non-JSON SSE lines; the matching JSON-RPC response is enough.
      }
    }
    return events.length === 1 ? events[0] : events;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const responseSessionId = response.headers.get('mcp-session-id');
  if (responseSessionId) sessionId = responseSessionId;

  const text = await response.text();
  const parsed = parseResponseBody(text, response.headers.get('content-type') || '');

  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500);
    throw new Error(`${method} failed: HTTP ${response.status} ${detail}`);
  }

  if (notification) return parsed;

  const messages = Array.isArray(parsed) ? parsed : [parsed];
  const matching = messages.find((message) => message && message.id === id) || messages.find(Boolean);
  if (matching?.error) throw new Error(`${method} MCP error: ${JSON.stringify(matching.error)}`);
  return matching?.result ?? matching;
}

async function initialize() {
  let lastError;
  for (const protocolVersion of PROTOCOL_VERSIONS) {
    try {
      const result = await rpc('initialize', {
        protocolVersion,
        capabilities: { tools: {} },
        clientInfo: { name: 'xuanpin-brightdata-probe', version: '1.0.0' },
      });
      await rpc('notifications/initialized', {}, { notification: true });
      return { protocolVersion, result };
    } catch (error) {
      lastError = error;
      sessionId = null;
    }
  }
  throw lastError;
}

function toolText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result.content)) {
    return result.content
      .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n');
  }
  return JSON.stringify(result);
}

function summarizeMarkdown(markdown) {
  const priceMatches = markdown.match(/\$\s*\d+(?:\.\d{1,2})?/g) || [];
  const soldMatches = markdown.match(/\b\d+(?:[.,]\d+)?\s*[kKmM]?\+?\s*sold\b/gi) || [];
  const reviewMatches = markdown.match(/\b\d[.,\d]*\s+reviews?\b/gi) || [];
  const ratingMatches = markdown.match(/\b[0-5](?:\.\d)?\s+(?:out of five stars|stars?)\b/gi) || [];
  const productUrlMatches = markdown.match(/https?:\/\/(?:www\.)?temu\.com\/[^\s)\]]+-g-\d+\.html[^\s)\]]*/gi) || [];

  return {
    chars: markdown.length,
    priceSignalCount: priceMatches.length,
    soldSignalCount: soldMatches.length,
    reviewSignalCount: reviewMatches.length,
    ratingSignalCount: ratingMatches.length,
    directProductUrlCount: new Set(productUrlMatches).size,
    priceExamples: [...new Set(priceMatches)].slice(0, 10),
    soldExamples: [...new Set(soldMatches)].slice(0, 10),
    reviewExamples: [...new Set(reviewMatches)].slice(0, 10),
  };
}

function buildTemuSearchUrl(query) {
  const url = new URL('https://www.temu.com/search_result.html');
  url.searchParams.set('search_key', query);
  url.searchParams.set('search_method', 'user');
  return url.toString();
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();

  const init = await initialize();
  const toolsResult = await rpc('tools/list');
  const tools = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
  const scrapeTool = tools.find((tool) => tool.name === 'scrape_as_markdown');

  if (!scrapeTool) {
    throw new Error(`scrape_as_markdown is unavailable. Tools: ${tools.map((tool) => tool.name).join(', ')}`);
  }

  const toolSummary = tools.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    inputProperties: Object.keys(tool.inputSchema?.properties || {}),
    required: tool.inputSchema?.required || [],
  }));

  const runs = [];
  for (const sample of SAMPLES) {
    const url = buildTemuSearchUrl(sample.query);
    const started = Date.now();
    try {
      const result = await rpc('tools/call', {
        name: 'scrape_as_markdown',
        arguments: { url },
      });
      const markdown = toolText(result);
      runs.push({
        ...sample,
        url,
        ok: true,
        durationMs: Date.now() - started,
        summary: summarizeMarkdown(markdown),
        preview: markdown.slice(0, 2500),
      });
      console.log(`${sample.label}: ok, ${markdown.length} chars`);
    } catch (error) {
      runs.push({
        ...sample,
        url,
        ok: false,
        durationMs: Date.now() - started,
        error: error.message,
      });
      console.error(`${sample.label}: ${error.message}`);
    }
  }

  const successful = runs.filter((run) => run.ok);
  const useful = successful.filter((run) => (
    run.summary.priceSignalCount > 0 ||
    run.summary.soldSignalCount > 0 ||
    run.summary.directProductUrlCount > 0
  ));

  const output = {
    startedAt,
    finishedAt: new Date().toISOString(),
    protocolVersion: init.protocolVersion,
    serverInfo: init.result?.serverInfo || null,
    capabilities: init.result?.capabilities || null,
    tools: toolSummary,
    testDefinition: {
      source: 'Temu public search pages via Bright Data MCP scrape_as_markdown',
      sampleCount: SAMPLES.length,
      targetMarketIntent: 'US/root temu.com public pages',
      note: 'This probe validates access/data richness only. It does not yet claim the returned page is geo-localized to US pricing unless the page content proves it.',
    },
    summary: {
      samples: runs.length,
      successful: successful.length,
      failed: runs.length - successful.length,
      usefulSignalSamples: useful.length,
      totalPriceSignals: successful.reduce((sum, run) => sum + run.summary.priceSignalCount, 0),
      totalSoldSignals: successful.reduce((sum, run) => sum + run.summary.soldSignalCount, 0),
      totalReviewSignals: successful.reduce((sum, run) => sum + run.summary.reviewSignalCount, 0),
      totalDirectProductUrls: successful.reduce((sum, run) => sum + run.summary.directProductUrlCount, 0),
    },
    runs,
  };

  const stamp = startedAt.replaceAll(':', '-').replaceAll('.', '-');
  const timestamped = path.join(OUTPUT_DIR, `probe-${stamp}.json`);
  const latest = path.join(OUTPUT_DIR, 'latest.json');
  fs.writeFileSync(timestamped, JSON.stringify(output, null, 2));
  fs.writeFileSync(latest, JSON.stringify(output, null, 2));

  console.log(JSON.stringify(output.summary, null, 2));
  console.log(`Saved: ${timestamped}`);

  if (successful.length === 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
