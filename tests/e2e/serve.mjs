import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));

process.loadEnvFile('.env');

const ROOT = 'dist';
// serve harness runs from repo root
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/json' };

function mockRes(res) {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => {
      res.statusCode = code;
      return {
        json: (data) => { headers['content-type'] = 'application/json'; send(JSON.stringify(data)); },
        end: (body) => send(body),
      };
    },
    json: (data) => { headers['content-type'] = 'application/json'; res.statusCode = res.statusCode || 200; send(JSON.stringify(data)); },
    end: (body) => send(body),
  };
  function send(body) {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    res.end(body);
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '').replace(/[^a-z0-9-]/g, '');
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString();
  let body;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { res.statusCode = 400; return res.end(JSON.stringify({ error: 'bad json' })); }
  const mres = mockRes(res);
  try {
    const h = (await import(new URL(`./api/${name}.mjs`, import.meta.url).href)).default;
    await h({ method: req.method, body, query: Object.fromEntries(url.searchParams), headers: req.headers }, mres);
  } catch (e) {
    console.error('[api-crash]', name, '→', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'SERVER_' + (e.message || 'error') }));
    }
  }
}

createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApi(req, res);
    let p = normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p === '\\' || p === '') p = '/index.html';
    let fp = join(ROOT, p);
    try {
      const s = await stat(fp);
      if (s.isDirectory()) fp = join(fp, 'index.html');
    } catch {
      fp = join(ROOT, 'index.html'); // SPA fallback
    }
    const data = await readFile(fp).catch(() => null);
    if (!data) { res.statusCode = 404; return res.end('nf'); }
    res.setHeader('content-type', MIME[extname(fp)] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(4507, () => console.log('E2E server on :4507'));
