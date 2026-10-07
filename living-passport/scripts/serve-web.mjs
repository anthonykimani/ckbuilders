import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createPassport, addRepair, transferPassport } from '../src/passport.js';

const root = resolve(import.meta.dirname, '..', 'web');
const port = Number(process.env.PORT || 4184);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
let passport = null;

function json(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8_000) throw new Error('This entry is too long.');
  }
  try { return JSON.parse(raw || '{}'); } catch { throw new Error('Invalid entry.'); }
}

createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/api/passport' && request.method === 'GET') return json(response, 200, { passport });
    if (path.startsWith('/api/') && request.method === 'POST') {
      const input = await body(request);
      if (path === '/api/create') passport = createPassport(input);
      else if (path === '/api/repair') {
        if (!passport) throw new Error('Create a passport first.');
        passport = addRepair(passport, input);
      } else if (path === '/api/transfer') {
        if (!passport) throw new Error('Create a passport first.');
        passport = transferPassport(passport, input);
      } else return json(response, 404, { error: 'Unknown action.' });
      return json(response, 200, { passport });
    }
    if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
    const target = resolve(root, path === '/' ? 'index.html' : `.${decodeURIComponent(path)}`);
    if (target !== resolve(root, 'index.html') && !target.startsWith(root + sep)) return json(response, 404, { error: 'Not found.' });
    const content = await readFile(target);
    response.writeHead(200, { 'content-type': `${types[extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' });
    response.end(content);
  } catch (error) {
    json(response, error.code === 'ENOENT' ? 404 : 400, { error: error.code === 'ENOENT' ? 'Not found.' : error.message });
  }
}).listen(port, '127.0.0.1', () => console.log(`Living Passport local workspace: http://127.0.0.1:${port}`));
