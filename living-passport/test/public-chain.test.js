import test from 'node:test';
import assert from 'node:assert/strict';
import { Cell, CellInput, OutPoint, Script, Transaction, hashCkb } from '@ckb-ccc/core';
import { CAPACITY, encodeRecord } from '../src/chain-codec.js';
import { loadPassport, passportType } from '../src/public-chain.js';

const digest = (value) => hashCkb(new TextEncoder().encode(value));
const deployment = { codeHash: digest('contract'), hashType: 'data2' };
const args = `0x${'11'.repeat(68)}`;
const type = passportType(deployment, args);
const first = Script.from({ codeHash: digest('lock'), hashType: 'type', args: '0x01' });
const second = Script.from({ codeHash: digest('lock'), hashType: 'type', args: '0x02' });
const fundingHash = digest('funding');
const mintHash = digest('mint tx');
const transferHash = digest('transfer tx');
const itemId = digest('item');

function input(txHash, index, lock, outputType, data, capacity) {
  return CellInput.from({ previousOutput: { txHash, index }, cellOutput: { lock, type: outputType, capacity }, outputData: data });
}

function fixture() {
  const funding = Transaction.default();
  funding.addOutput({ lock: first, capacity: CAPACITY + 100_000_000n }, '0x');
  const mint = encodeRecord({ action: 0, sequence: 0, itemId, previousRoot: itemId, actorHash: first.hash(), recipientHash: first.hash(), detail: 'ThinkPad T480 / Amina' });
  const created = Transaction.default();
  created.inputs.push(input(fundingHash, 0, first, undefined, '0x', CAPACITY + 100_000_000n));
  created.addOutput({ lock: first, type, capacity: CAPACITY }, mint.data);
  const transfer = encodeRecord({ action: 2, sequence: 1, itemId, previousRoot: mint.historyRoot, actorHash: first.hash(), recipientHash: second.hash(), detail: 'Transferred to Brian' });
  const moved = Transaction.default();
  moved.inputs.push(input(mintHash, 0, first, type, mint.data, CAPACITY));
  moved.addOutput({ lock: second, type, capacity: CAPACITY }, transfer.data);
  const transactions = new Map([[fundingHash, funding], [mintHash, created], [transferHash, moved]]);
  const live = Cell.from({ outPoint: OutPoint.from({ txHash: transferHash, index: 0 }), cellOutput: { lock: second, type, capacity: CAPACITY }, outputData: transfer.data });
  const client = { findSingletonCellByType: async () => live, getTransaction: async (hash) => ({ status: 'committed', transaction: transactions.get(hash) }) };
  return { client, live };
}

test('reads ordered passport events from confirmed transactions', async () => {
  const { client } = fixture();
  const passport = await loadPassport(client, deployment, args);
  assert.equal(passport.events.length, 2);
  assert.equal(passport.events[0].detail, 'ThinkPad T480 / Amina');
  assert.equal(passport.events[1].detail, 'Transferred to Brian');
  assert.equal(passport.ownerLockHash, second.hash());
  assert.equal(passport.sequence, 1);
});

test('rejects a live Cell whose owner differs from the recorded recipient', async () => {
  const { client, live } = fixture();
  client.findSingletonCellByType = async () => Cell.from({ ...live, cellOutput: { lock: first, type, capacity: CAPACITY } });
  await assert.rejects(() => loadPassport(client, deployment, args), /live Cell/);
});
