import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Transaction, hashCkb, hexFrom } from '@ckb-ccc/core';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const binary = readFileSync(new URL('../rust-contract/target/riscv64imac-unknown-none-elf/release/living-passport-type', import.meta.url));
const CAPACITY = 30_000_000_000n;
const itemId = hashCkb(new TextEncoder().encode('example-laptop-serial-001'));
const event = (name) => hashCkb(new TextEncoder().encode(name));
const bytes = (value) => Buffer.from(value.slice(2), 'hex');
const root = (previous, nextEvent) => hashCkb(Buffer.concat([bytes(previous), bytes(nextEvent)]));

function record(action, sequence, historyRoot, eventHash, overrides = {}) {
  return { action, sequence, itemId, historyRoot, eventHash, capacity: CAPACITY, ...overrides };
}

function encode(record) {
  const data = Buffer.alloc(102);
  data[0] = 1;
  data[1] = record.action;
  data.writeUInt32LE(record.sequence, 2);
  bytes(record.itemId).copy(data, 6);
  bytes(record.historyRoot).copy(data, 38);
  bytes(record.eventHash).copy(data, 70);
  return hexFrom(data);
}

const mintEvent = event('mint');
const repairEvent = event('repair');
const transferEvent = event('transfer');
const mint = record(0, 0, root(itemId, mintEvent), mintEvent);
const repair = record(1, 1, root(mint.historyRoot, repairEvent), repairEvent);
const transfer = record(2, 2, root(repair.historyRoot, transferEvent), transferEvent);

async function verify({ before, after, attested = false, recipient = false, wrongId = false }) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const deployed = resource.deployCell(hexFrom(binary), tx, false);
  const lockBinary = hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS));
  const owner = resource.deployCell(lockBinary, tx, false);
  const attester = owner.clone(); attester.args = '0x01';
  const newOwner = owner.clone(); newOwner.args = '0x02';
  const funding = resource.mockCell(owner, undefined, '0x', CAPACITY + 100_000_000n);
  const type = deployed.clone();
  type.args = hexFrom(Buffer.concat([
    wrongId ? Buffer.alloc(36, 7) : Buffer.from(funding.outPoint.toBytes()),
    bytes(attester.hash()),
  ]));
  if (before) {
    const old = resource.mockCell(owner, type, encode(before), before.capacity);
    tx.inputs.push(Resource.createCellInput(old));
  } else {
    tx.inputs.push(Resource.createCellInput(funding));
  }
  if (attested) {
    const evidence = resource.mockCell(attester, undefined, '0x', 6_100_000_000n);
    tx.inputs.push(Resource.createCellInput(evidence));
  }
  if (after) {
    tx.outputs.push(Resource.createCellOutput(recipient ? newOwner : owner, type, after.capacity));
    tx.outputsData.push(encode(after));
  }
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return results[0];
}

test('CKB-VM accepts mint, attested repair, and ownership transfer', async () => {
  for (const [name, scenario] of [
    ['mint', { after: mint }],
    ['repair', { before: mint, after: repair, attested: true }],
    ['transfer', { before: repair, after: transfer, recipient: true }],
  ]) {
    const result = await verify(scenario);
    assert.equal(result.scriptErrorCode, 0, `${name}: ${result.stdout}`);
    console.log(`${name}: ${result.stdoutCycles} cycles`);
  }
});

test('CKB-VM rejects forged or broken transitions', async () => {
  const cases = [
    ['reused identity', { after: mint, wrongId: true }],
    ['mint to someone else', { after: mint, recipient: true }],
    ['repair without attester', { before: mint, after: repair }],
    ['repair redirects owner', { before: mint, after: repair, attested: true, recipient: true }],
    ['transfer keeps owner', { before: repair, after: transfer }],
    ['skip sequence', { before: mint, after: { ...repair, sequence: 2 }, attested: true }],
    ['rewrite item ID', { before: mint, after: { ...repair, itemId: event('other item') }, attested: true }],
    ['rewrite history', { before: mint, after: { ...repair, historyRoot: event('fake root') }, attested: true }],
    ['inflate capacity', { before: mint, after: { ...repair, capacity: CAPACITY + 1n }, attested: true }],
    ['zero event', { before: mint, after: { ...repair, eventHash: '0x' + '00'.repeat(32) }, attested: true }],
  ];
  for (const [name, scenario] of cases) {
    const result = await verify(scenario);
    assert.notEqual(result.scriptErrorCode, 0, `${name} unexpectedly passed`);
  }
});
