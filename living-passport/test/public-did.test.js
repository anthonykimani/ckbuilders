import test from 'node:test';
import assert from 'node:assert/strict';
import { Cell, OutPoint, Script, Transaction, hashCkb } from '@ckb-ccc/core';
import { didCkb } from '@ckb-ccc/did-ckb';
import { findShops, readShop, shopDocument } from '../src/public-did.js';

const digest = (value) => hashCkb(new TextEncoder().encode(value));
const lock = (byte) => Script.from({ codeHash: digest('lock'), hashType: 'type', args: `0x${byte.repeat(20)}` });
const shop = lock('01');
const attacker = lock('02');
const known = { codeHash: digest('did'), hashType: 'type' };

// A chain of DID cells, newest first. Each is written by a transaction spending `signer`'s cell.
function chain(...cells) {
  const transactions = new Map();
  const live = cells.map(({ holder, signer, name, id, data }) => {
    const fundingHash = digest(`funding ${id}`);
    const funding = Transaction.default();
    funding.addOutput({ lock: signer, capacity: 1000n }, '0x');
    const writeHash = digest(`write ${id}`);
    const write = Transaction.default();
    write.inputs.push({ previousOutput: { txHash: fundingHash, index: 0 }, since: 0n });
    transactions.set(fundingHash, funding);
    transactions.set(writeHash, write);
    const type = { ...known, args: `0x${id.repeat(20)}` };
    return Cell.from({ outPoint: OutPoint.from({ txHash: writeHash, index: 0 }), cellOutput: { lock: holder, type, capacity: 1000n }, outputData: data ?? didCkb.DidCkbData.from({ value: { document: shopDocument({ name }) } }).toHex() });
  });
  return {
    getKnownScript: async () => known,
    findCells: async function* () { yield* live; },
    getTransaction: async (hash) => ({ status: 'committed', transaction: transactions.get(hash) }),
  };
}

test('resolves a shop name from a DID its own wallet wrote', async () => {
  const shops = await findShops(chain({ holder: shop, signer: shop, name: 'Dflex', id: 'aa' }), [shop.hash()]);
  const found = shops.get(shop.hash());
  assert.equal(found.name, 'Dflex');
  assert.equal(found.did, didCkb.argsToDid(`0x${'aa'.repeat(20)}`));
});

test('ignores a DID someone else created under the shop wallet', async () => {
  const client = chain({ holder: shop, signer: attacker, name: 'Scam Shop', id: 'bb' });
  assert.equal((await findShops(client, [shop.hash()])).size, 0);
});

test('a forged newer DID does not replace the real name', async () => {
  const client = chain(
    { holder: shop, signer: attacker, name: 'Scam Shop', id: 'bb' },
    { holder: shop, signer: shop, name: 'Dflex', id: 'aa' },
  );
  assert.equal((await findShops(client, [shop.hash()])).get(shop.hash()).name, 'Dflex');
});

test('skips undecodable cells and DIDs that are not shops', async () => {
  const other = didCkb.DidCkbData.from({ value: { document: { services: { atproto_pds: { type: 'AtprotoPersonalDataServer' } } } } }).toHex();
  const client = chain({ holder: shop, signer: shop, id: 'cc', data: '0x00' }, { holder: shop, signer: shop, id: 'dd', data: other });
  assert.equal((await findShops(client, [shop.hash()])).size, 0);
});

test('keeps other services when updating a document', () => {
  const base = { alsoKnownAs: ['at://dflex'], verificationMethods: { atproto: 'did:key:z' }, services: { atproto_pds: { type: 'x' } } };
  const document = shopDocument({ name: 'Dflex', location: 'Nairobi' }, base);
  assert.deepEqual(document.alsoKnownAs, base.alsoKnownAs);
  assert.deepEqual(document.services.atproto_pds, base.services.atproto_pds);
  assert.deepEqual(readShop(document), { name: 'Dflex', location: 'Nairobi' });
});

test('rejects empty names and strips hidden characters from names it reads', () => {
  assert.throws(() => shopDocument({ name: '   ' }), /shop name/);
  assert.throws(() => shopDocument({ name: 'x'.repeat(61) }), /shop name/);
  const hidden = { services: { living_passport: { type: 'LivingPassportShop', name: 'Dfl‮ex\n' } } };
  assert.equal(readShop(hidden).name, 'Dflex');
  assert.equal(readShop({ services: { living_passport: { type: 'LivingPassportShop', name: 42 } } }), null);
});
