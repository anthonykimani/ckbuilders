// Repair inbox: holds signed repair drafts so the owner finds them on their device page
// instead of needing a link. It stores nothing secret (drafts are public transactions with
// the workshop's signature) and never signs. The owner's app re-checks every draft itself.
//
//   PORT=4310 INBOX_DATA=/var/lib/living-passport/inbox.json node inbox/server.mjs
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ClientPublicTestnet } from '@ckb-ccc/core';
import { decodeRequest, reviewRepair } from '../src/public-repair.js';

const port = Number(process.env.PORT ?? 4310);
const file = process.env.INBOX_DATA ?? new URL('./inbox.json', import.meta.url).pathname;
const deployment = JSON.parse(readFileSync(new URL('../public-web/deployment.testnet.json', import.meta.url), 'utf8'));
const client = new ClientPublicTestnet({ url: process.env.CKB_RPC ?? 'https://testnet.ckb.dev/' });
const MAX_BODY = 64 * 1024;
const MAX_PER_PASSPORT = 5;
const TTL = 14 * 24 * 3600 * 1000;
const ID = /^0x[0-9a-fA-F]{136}$/;

let drafts = [];
try { drafts = JSON.parse(readFileSync(file, 'utf8')); } catch { /* first run */ }
function save() {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(drafts));
  renameSync(`${file}.tmp`, file);
}

// A draft stays only while it still passes the owner's checks: the passport has not moved,
// the workshop is still an input, the successor record still chains correctly.
async function stillValid(draft) {
  try { await reviewRepair(client, deployment, await decodeRequest(draft.request)); return true; } catch { return false; }
}

const posts = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (posts.get(ip) ?? []).filter((t) => now - t < 3600 * 1000);
  recent.push(now);
  posts.set(ip, recent);
  return recent.length > 30;
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Draft is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://inbox');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, null);
    if (url.pathname === '/health') return send(res, 200, { ok: true, drafts: drafts.length });

    if (url.pathname === '/drafts' && req.method === 'POST') {
      const ip = req.headers['x-real-ip'] ?? req.socket.remoteAddress;
      if (limited(ip)) return send(res, 429, { error: 'Too many drafts from this address. Try again later.' });
      const { request } = await readBody(req);
      if (typeof request !== 'string') return send(res, 400, { error: 'Missing draft.' });
      const decoded = await decodeRequest(request);
      const summary = await reviewRepair(client, deployment, decoded);
      drafts = drafts.filter((d) => d.txHash !== summary.txHash);
      const others = drafts.filter((d) => d.passport === decoded.passport);
      if (others.length >= MAX_PER_PASSPORT) drafts = drafts.filter((d) => d !== others[0]);
      drafts.push({ passport: decoded.passport, request, txHash: summary.txHash, note: summary.note, sequence: summary.sequence, createdAt: Date.now() });
      save();
      return send(res, 201, { txHash: summary.txHash });
    }

    if (url.pathname === '/drafts' && req.method === 'GET') {
      const ids = (url.searchParams.get('passports') ?? '').split(',').filter((id) => ID.test(id)).slice(0, 50);
      const now = Date.now();
      const wanted = drafts.filter((d) => ids.includes(d.passport) && now - d.createdAt < TTL);
      const checked = await Promise.all(wanted.map(async (d) => [d, await stillValid(d)]));
      const stale = new Set(checked.filter(([, ok]) => !ok).map(([d]) => d));
      if (stale.size || drafts.some((d) => now - d.createdAt >= TTL)) {
        drafts = drafts.filter((d) => !stale.has(d) && now - d.createdAt < TTL);
        save();
      }
      return send(res, 200, { drafts: checked.filter(([, ok]) => ok).map(([d]) => d) });
    }
    return send(res, 404, { error: 'Not found.' });
  } catch (error) {
    return send(res, error.status ?? 400, { error: error.message ?? 'Bad request.' });
  }
}).listen(port, '127.0.0.1', () => console.log(`repair inbox on 127.0.0.1:${port}, ${drafts.length} drafts`));
