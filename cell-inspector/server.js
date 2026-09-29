import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { inspectTransaction, RPC_URLS } from './inspector.js';

const root = dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

async function rpc(network, method, params) {
  const upstream = RPC_URLS[network];
  if (!upstream) throw new Error('Choose mainnet or testnet.');
  const response = await fetch(upstream, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`CKB node returned HTTP ${response.status}. Try again.`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'The CKB node rejected this request.');
  return body.result;
}

export function startServer(port = Number(process.env.PORT || 4177)) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method !== 'GET') {
      response.writeHead(405).end('Method not allowed');
      return;
    }
    if (url.pathname === '/api/inspect') {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      try {
        const network = url.searchParams.get('network') || 'testnet';
        if (!RPC_URLS[network]) throw new Error('Choose mainnet or testnet.');
        const hash = url.searchParams.get('hash') || '';
        const data = await inspectTransaction((method, params) => rpc(network, method, params), hash);
        response.writeHead(200).end(JSON.stringify({ network, ...data }));
      } catch (error) {
        const message = error?.name === 'TimeoutError' ? 'The CKB node timed out. Try again.' : error.message;
        const status = /Enter a|Choose mainnet/.test(message) ? 400 : /not found/.test(message) ? 404 : 502;
        response.writeHead(status).end(JSON.stringify({ error: message }));
      }
      return;
    }
    const asset = assets.get(url.pathname);
    if (!asset) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      response.setHeader('content-type', asset[1]);
      response.writeHead(200).end(await readFile(join(root, 'public', asset[0])));
    } catch {
      response.writeHead(500).end('Could not load the page');
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`Cell Inspector: http://127.0.0.1:${port}`));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startServer();
