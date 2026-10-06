import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = resolve(root, pathname === '/' ? 'web/index.html' : `.${pathname}`);
    if (!target.startsWith(root + sep) || !['/web/', '/src/'].some((prefix) => pathname.startsWith(prefix)) && pathname !== '/') {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': `${types[extname(target)] || 'application/octet-stream'}; charset=utf-8`, 'cache-control': 'no-store' }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Cell Forge practice: http://127.0.0.1:${port}`));
