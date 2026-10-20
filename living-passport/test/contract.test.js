import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Transaction, hashCkb, hexFrom } from '@ckb-ccc/core';
import { CAPACITY, encodeRecord } from '../src/chain-codec.js';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const binary = readFileSync(new URL('../rust-contract/target/riscv64imac-unknown-none-elf/release/living-passport-type', import.meta.url));
const itemId = hashCkb(new TextEncoder().encode('example-laptop-serial-001'));
const bytes = (value) => Buffer.from(value.slice(2), 'hex');
const lockBinary = hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS));

async function verify({ kind, before, mutate, attested = false, recipient = false, wrongId = false, close = false, extraInput = false }) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const deployed = resource.deployCell(hexFrom(binary), tx, false);
  const owner = resource.deployCell(lockBinary, tx, false);
  const attester = owner.clone(); attester.args = '0x01';
  const newOwner = owner.clone(); newOwner.args = '0x02';
  const funding = resource.mockCell(owner, undefined, '0x', CAPACITY + 100_000_000n);
  const type = deployed.clone();
  type.args = hexFrom(Buffer.concat([wrongId ? Buffer.alloc(36, 7) : Buffer.from(funding.outPoint.toBytes()), bytes(attester.hash())]));
  const mint = encodeRecord({ action: 0, sequence: 0, itemId, previousRoot: itemId, actorHash: owner.hash(), recipientHash: owner.hash(), detail: 'ThinkPad T480 / Amina' });
  const repair = encodeRecord({ action: 1, sequence: 1, itemId, previousRoot: mint.historyRoot, actorHash: attester.hash(), recipientHash: owner.hash(), detail: 'Replaced battery' });
  const transfer = encodeRecord({ action: 2, sequence: 2, itemId, previousRoot: repair.historyRoot, actorHash: owner.hash(), recipientHash: newOwner.hash(), detail: 'Transferred to Brian' });
  const records = { mint, repair, transfer };
  const after = mutate ? mutate({ ...records[kind] }, { owner, attester, newOwner }) : records[kind];
  if (before) tx.inputs.push(Resource.createCellInput(resource.mockCell(owner, type, records[before].data, CAPACITY)));
  else tx.inputs.push(Resource.createCellInput(funding));
  if (attested) tx.inputs.push(Resource.createCellInput(resource.mockCell(attester, undefined, '0x', 6_100_000_000n)));
  if (extraInput) tx.inputs.push(Resource.createCellInput(resource.mockCell(owner, type, records.mint.data, CAPACITY)));
  if (close) {
    tx.outputs.push(Resource.createCellOutput(owner, undefined, CAPACITY));
    tx.outputsData.push('0x');
  } else {
    tx.outputs.push(Resource.createCellOutput(recipient ? newOwner : owner, type, after.capacity ?? CAPACITY));
    tx.outputsData.push(after.data);
  }
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return results[0];
}

test('CKB-VM accepts mint, attested repair, and ownership transfer', async () => {
  for (const [kind, before, attested, recipient] of [['mint', null, false, false], ['repair', 'mint', true, false], ['transfer', 'repair', false, true]]) {
    const result = await verify({ kind, before, attested, recipient });
    assert.equal(result.scriptErrorCode, 0, `${kind}: ${result.stdout}`);
    console.log(`${kind}: ${result.stdoutCycles} cycles`);
  }
});

test('CKB-VM rejects forged data and recipient bindings', async () => {
  const flip = (hex, byte) => { const data = bytes(hex); data[byte] ^= 1; return hexFrom(data); };
  const tamper = (byte) => (r) => ({ ...r, data: flip(r.data, byte) });
  const cases = [
    ['reused identity', { kind: 'mint', wrongId: true }],
    ['mint to another Lock', { kind: 'mint', recipient: true }],
    ['repair without workshop input', { kind: 'repair', before: 'mint' }],
    ['repair redirects owner', { kind: 'repair', before: 'mint', attested: true, recipient: true }],
    ['transfer keeps owner', { kind: 'transfer', before: 'repair' }],
    ['changed readable repair note', { kind: 'repair', before: 'mint', attested: true, mutate: tamper(204) }],
    ['changed actor Lock hash', { kind: 'repair', before: 'mint', attested: true, mutate: tamper(139) }],
    ['changed intended recipient', { kind: 'transfer', before: 'repair', recipient: true, mutate: tamper(171) }],
    ['skipped sequence', { kind: 'repair', before: 'mint', attested: true, mutate: tamper(2) }],
    ['changed history root', { kind: 'repair', before: 'mint', attested: true, mutate: tamper(38) }],
    ['changed item ID', { kind: 'repair', before: 'mint', attested: true, mutate: tamper(6) }],
    ['inflated capacity', { kind: 'repair', before: 'mint', attested: true, mutate: (r) => ({ ...r, capacity: CAPACITY + 1n }) }],
  ];
  for (const [name, scenario] of cases) {
    const result = await verify(scenario);
    assert.notEqual(result.scriptErrorCode, 0, `${name} unexpectedly passed`);
  }
});

test('CKB-VM lets the owner close a passport and reclaim its capacity', async () => {
  const result = await verify({ kind: 'repair', before: 'repair', close: true });
  assert.equal(result.scriptErrorCode, 0, result.stdout);
});

test('CKB-VM rejects closing two passports in one transaction', async () => {
  const result = await verify({ kind: 'repair', before: 'repair', close: true, extraInput: true });
  assert.notEqual(result.scriptErrorCode, 0);
});
