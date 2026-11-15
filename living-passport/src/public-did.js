import { didCkb } from '@ckb-ccc/did-ckb';
import { KnownScript, Script, bytesFrom } from '@ckb-ccc/core';
import { signedByHolder, submit } from './public-signed.js';

// A shop's name lives in its own did:ckb cell, under a service entry of the standard document.
const SERVICE = 'living_passport';
const SERVICE_TYPE = 'LivingPassportShop';
const MAX_NAME = 60;
const MAX_LOCATION = 60;
const MAX_VOUCHES = 20;

function field(value, max) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\p{C}/gu, '').trim();
  return new TextEncoder().encode(clean).length <= max ? clean : '';
}

export function shopDocument({ name, location, vouches }, base = {}) {
  const shopName = field(name, MAX_NAME);
  if (!shopName) throw new Error(`Enter a shop name of 1–${MAX_NAME} bytes.`);
  const place = field(location ?? '', MAX_LOCATION);
  if ((location ?? '').trim() && !place) throw new Error(`Keep the location under ${MAX_LOCATION} bytes.`);
  // Edits that don't mention vouches keep the ones already published.
  const list = vouchList(vouches ?? base.services?.[SERVICE]?.vouches);
  return {
    verificationMethods: base.verificationMethods ?? {},
    alsoKnownAs: base.alsoKnownAs ?? [],
    services: { ...base.services, [SERVICE]: { type: SERVICE_TYPE, name: shopName, ...(place ? { location: place } : {}), ...(list.length ? { vouches: list } : {}) } },
  };
}

export function readShop(document) {
  const service = document?.services?.[SERVICE];
  if (service?.type !== SERVICE_TYPE) return null;
  const name = field(service.name, MAX_NAME);
  return name ? { name, location: field(service.location, MAX_LOCATION) } : null;
}

function vouchList(value, own) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((did) => typeof did === 'string' && didCkb.isDidCkb(did) && did !== own))].slice(0, MAX_VOUCHES);
}

// Every shop on chain whose document its own wallet wrote. Scans all live DID cells, which is
// fine for a pilot; an indexer would replace this at scale. Newest valid cell wins per Lock.
export async function loadShops(client) {
  const { codeHash, hashType } = await client.getKnownScript(KnownScript.DidCkb);
  const search = { script: { codeHash, hashType, args: '0x' }, scriptType: 'type', scriptSearchMode: 'prefix', withData: true };
  const candidates = [];
  for await (const cell of client.findCells(search, 'desc', 200)) {
    const args = cell.cellOutput.type.args;
    if (bytesFrom(args).length !== 20) continue;
    try {
      const document = didCkb.DidCkbData.decode(cell.outputData).value.document;
      const shop = readShop(document);
      const did = didCkb.argsToDid(args);
      if (shop) candidates.push({ cell, shop: { ...shop, id: args, did, lockHash: cell.cellOutput.lock.hash(), vouches: vouchList(document.services[SERVICE].vouches, did) } });
    } catch { /* not a document we can read */ }
  }
  const shops = new Map();
  for (const { cell, shop } of candidates) {
    if (!shops.has(shop.lockHash) && await signedByHolder(client, cell).catch(() => false)) shops.set(shop.lockHash, shop);
  }
  return [...shops.values()];
}

// A shop's vouches come from other shops' documents. One per wallet, never its own.
export function withVouches(shop, all) {
  const vouchedBy = all.filter((other) => other.lockHash !== shop.lockHash && other.vouches.includes(shop.did)).map(({ name, did }) => ({ name, did }));
  return { ...shop, vouchedBy };
}

// Shop identity for each wanted Lock hash.
export async function findShops(client, lockHashes) {
  const wanted = new Set(lockHashes);
  const found = new Map();
  if (!wanted.size) return found;
  const all = await loadShops(client);
  for (const shop of all) if (wanted.has(shop.lockHash)) found.set(shop.lockHash, withVouches(shop, all));
  return found;
}

export async function findShopByDid(client, did) {
  if (!didCkb.isDidCkb(did.trim())) throw new Error('Enter a did:ckb: identifier.');
  const all = await loadShops(client);
  const shop = all.find((s) => s.did === did.trim());
  if (!shop) throw new Error('No shop has published that DID from its own wallet.');
  return withVouches(shop, all);
}

export async function saveShop(signer, details, existing = null) {
  if (!signer || signer.client.addressPrefix !== 'ckt') throw new Error('Connect a CKB testnet wallet first.');
  const lock = (await signer.getRecommendedAddressObj()).script;
  if (!existing) {
    const { tx, id } = await didCkb.createDidCkb({ signer, data: { value: { document: shopDocument(details) } } });
    return { txHash: await submit(signer, tx), did: didCkb.argsToDid(id) };
  }
  if (existing.lockHash !== lock.hash()) throw new Error('This wallet does not hold that identity.');
  const { tx } = await didCkb.transferDidCkb({
    client: signer.client, id: existing.id, receiver: Script.from(lock),
    data: (_, current) => ({ value: { document: shopDocument(details, current?.value.document), localId: current?.value.localId } }),
  });
  return { txHash: await submit(signer, tx), did: existing.did };
}

// Spends the DID cell with no successor, returning its capacity to the wallet as change.
export async function removeShop(signer, existing) {
  const lock = (await signer.getRecommendedAddressObj()).script;
  if (existing.lockHash !== lock.hash()) throw new Error('This wallet does not hold that identity.');
  const { tx } = await didCkb.destroyDidCkb({ client: signer.client, id: existing.id });
  return { txHash: await submit(signer, tx) };
}
