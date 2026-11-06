import { didCkb } from '@ckb-ccc/did-ckb';
import { KnownScript, Script, Transaction, bytesFrom } from '@ckb-ccc/core';

// A shop's name lives in its own did:ckb cell, under a service entry of the standard document.
const SERVICE = 'living_passport';
const SERVICE_TYPE = 'LivingPassportShop';
const MAX_NAME = 60;
const MAX_LOCATION = 60;

function field(value, max) {
  if (typeof value !== 'string') return '';
  const clean = value.replace(/\p{C}/gu, '').trim();
  return new TextEncoder().encode(clean).length <= max ? clean : '';
}

export function shopDocument({ name, location }, base = {}) {
  const shopName = field(name, MAX_NAME);
  if (!shopName) throw new Error(`Enter a shop name of 1–${MAX_NAME} bytes.`);
  const place = field(location ?? '', MAX_LOCATION);
  if ((location ?? '').trim() && !place) throw new Error(`Keep the location under ${MAX_LOCATION} bytes.`);
  return {
    verificationMethods: base.verificationMethods ?? {},
    alsoKnownAs: base.alsoKnownAs ?? [],
    services: { ...base.services, [SERVICE]: { type: SERVICE_TYPE, name: shopName, ...(place ? { location: place } : {}) } },
  };
}

export function readShop(document) {
  const service = document?.services?.[SERVICE];
  if (service?.type !== SERVICE_TYPE) return null;
  const name = field(service.name, MAX_NAME);
  return name ? { name, location: field(service.location, MAX_LOCATION) } : null;
}

// Creating a DID cell under someone else's Lock needs no signature from them. So a document
// only speaks for a Lock if that Lock also signed the transaction that wrote it, which means
// one of the transaction's inputs is locked by it.
async function signedByHolder(client, cell) {
  const lockHash = cell.cellOutput.lock.hash();
  const result = await client.getTransaction(cell.outPoint.txHash);
  if (result?.status !== 'committed' || !result.transaction) return false;
  const tx = Transaction.from(result.transaction);
  for (const input of tx.inputs) {
    const previous = await client.getTransaction(input.previousOutput.txHash);
    const spent = previous?.transaction && Transaction.from(previous.transaction).outputs[Number(input.previousOutput.index)];
    if (spent?.lock.hash() === lockHash) return true;
  }
  return false;
}

// Shop identity for each wanted Lock hash. Scans all live DID cells, which is fine for a
// pilot; an indexer would replace this at scale. Newest valid cell wins if a Lock has several.
export async function findShops(client, lockHashes) {
  const wanted = new Set(lockHashes);
  const shops = new Map();
  if (!wanted.size) return shops;
  const { codeHash, hashType } = await client.getKnownScript(KnownScript.DidCkb);
  const search = { script: { codeHash, hashType, args: '0x' }, scriptType: 'type', scriptSearchMode: 'prefix', withData: true };
  const candidates = [];
  for await (const cell of client.findCells(search, 'desc', 200)) {
    const lockHash = cell.cellOutput.lock.hash();
    const args = cell.cellOutput.type.args;
    if (!wanted.has(lockHash) || bytesFrom(args).length !== 20) continue;
    try {
      const shop = readShop(didCkb.DidCkbData.decode(cell.outputData).value.document);
      if (shop) candidates.push({ cell, lockHash, shop: { ...shop, id: args, did: didCkb.argsToDid(args), lockHash } });
    } catch { /* not a document we can read */ }
  }
  for (const { cell, lockHash, shop } of candidates) {
    if (!shops.has(lockHash) && await signedByHolder(client, cell).catch(() => false)) shops.set(lockHash, shop);
  }
  return shops;
}

async function submit(signer, tx) {
  try {
    await tx.completeInputsByCapacity(signer);
  } catch {
    throw new Error('This wallet needs more testnet CKB for this. Fund it from the testnet faucet.');
  }
  await tx.completeFeeBy(signer);
  const hash = await signer.sendTransaction(tx);
  const confirmed = await signer.client.waitTransaction(hash, 0, 120000, 2000);
  if (!confirmed) throw new Error(`Submitted ${hash}, but confirmation timed out. Check the explorer before retrying.`);
  return hash;
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
