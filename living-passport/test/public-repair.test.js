import test from 'node:test';
import assert from 'node:assert/strict';
import { Cell, CellInput, OutPoint, Script, Transaction, bytesConcat, bytesFrom, hashCkb, hexFrom } from '@ckb-ccc/core';
import { CAPACITY, encodeRecord } from '../src/chain-codec.js';
import { passportType } from '../src/public-chain.js';
import { decodeRequest, encodeRequest, reviewRepair } from '../src/public-repair.js';

const digest = (value) => hashCkb(new TextEncoder().encode(value));
const owner = Script.from({ codeHash: digest('lock'), hashType: 'type', args: '0x01' });
const workshop = Script.from({ codeHash: digest('lock'), hashType: 'type', args: '0x02' });
const stranger = Script.from({ codeHash: digest('lock'), hashType: 'type', args: '0x03' });
const deployment = { codeHash: digest('contract'), hashType: 'data2', txHash: digest('deploy'), index: 0 };
const args = hexFrom(bytesConcat(new Uint8Array(36).fill(9), bytesFrom(workshop.hash())));
const type = passportType(deployment, args);
const itemId = digest('item');
const mint = encodeRecord({ action: 0, sequence: 0, itemId, previousRoot: itemId, actorHash: owner.hash(), recipientHash: owner.hash(), detail: 'ThinkPad T480 / Amina' });
const passportPoint = OutPoint.from({ txHash: digest('mint tx'), index: 0 });
const workshopPoint = OutPoint.from({ txHash: digest('workshop funds'), index: 0 });
const ownerPoint = OutPoint.from({ txHash: digest('owner funds'), index: 0 });

function setup({ repair = {}, extraOwnerInput = false, workshopInput = true, live = true } = {}) {
  const cells = new Map([
    [passportPoint, Cell.from({ outPoint: passportPoint, cellOutput: { lock: owner, type, capacity: CAPACITY }, outputData: mint.data })],
    [workshopPoint, Cell.from({ outPoint: workshopPoint, cellOutput: { lock: workshop, capacity: 50_000_000_000n }, outputData: '0x' })],
    [ownerPoint, Cell.from({ outPoint: ownerPoint, cellOutput: { lock: owner, capacity: 50_000_000_000n }, outputData: '0x' })],
  ]);
  const record = encodeRecord({ action: 1, sequence: 1, itemId, previousRoot: mint.historyRoot, actorHash: workshop.hash(), recipientHash: owner.hash(), detail: 'Replaced battery', ...repair.record });
  const tx = Transaction.default();
  tx.inputs.push(CellInput.from({ previousOutput: passportPoint }));
  if (workshopInput) tx.inputs.push(CellInput.from({ previousOutput: workshopPoint }));
  if (extraOwnerInput) tx.inputs.push(CellInput.from({ previousOutput: ownerPoint }));
  tx.addOutput({ lock: repair.lock ?? owner, type, capacity: repair.capacity ?? CAPACITY }, repair.data ?? record.data);
  tx.addOutput({ lock: workshop, capacity: 49_900_000_000n }, '0x');
  tx.cellDeps.push({ outPoint: { txHash: deployment.txHash, index: 0 }, depType: 'code' });
  const find = (point) => [...cells.values()].find((cell) => cell.outPoint.eq(point));
  const client = { getCell: async (point) => find(OutPoint.from(point)), getCellLive: async (point) => (live ? find(OutPoint.from(point)) : undefined) };
  return { client, request: { v: 1, passport: args, tx } };
}

test('owner review accepts a well-formed workshop repair', async () => {
  const { client, request } = setup();
  const summary = await reviewRepair(client, deployment, request);
  assert.equal(summary.note, 'Replaced battery');
  assert.equal(summary.sequence, 1);
  assert.equal(summary.ownerLockHash, owner.hash());
});

test('owner review rejects requests that are unsafe to sign', async () => {
  const cases = [
    ['redirects the passport', { repair: { lock: stranger } }],
    ['changes capacity', { repair: { capacity: CAPACITY - 1n } }],
    ['claims another actor', { repair: { record: { actorHash: stranger.hash() } } }],
    ['skips a sequence number', { repair: { record: { sequence: 2 } } }],
    ['spends extra owner funds', { extraOwnerInput: true }],
    ['has no workshop input', { workshopInput: false }],
    ['uses a passport that already moved', { live: false }],
  ];
  for (const [name, options] of cases) {
    const { client, request } = setup(options);
    await assert.rejects(() => reviewRepair(client, deployment, request), (error) => { console.log(`${name}: ${error.message}`); return true; });
  }
});

test('repair request survives the share-link round trip', async () => {
  const { client, request } = setup();
  const encoded = await encodeRequest(request);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const decoded = await decodeRequest(encoded);
  assert.equal(decoded.passport, args);
  assert.equal(decoded.tx.hash(), request.tx.hash());
  await reviewRepair(client, deployment, decoded);
  await assert.rejects(() => decodeRequest(encoded.slice(0, -10)), /damaged/);
});
