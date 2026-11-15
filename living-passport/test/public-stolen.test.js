import test from 'node:test';
import assert from 'node:assert/strict';
import { Cell, OutPoint, Script, Transaction, hashCkb } from '@ckb-ccc/core';
import { decodeNote, encodeReport, findStolenReports } from '../src/public-stolen.js';

const digest = (value) => hashCkb(new TextEncoder().encode(value));
const lock = (byte) => Script.from({ codeHash: digest('lock'), hashType: 'type', args: `0x${byte.repeat(20)}` });
const owner = lock('01');
const stranger = lock('02');
const id = `0x${'11'.repeat(68)}`;
const passport = { id, ownerLock: owner, ownerLockHash: owner.hash() };

// Report cells under the owner's Lock, each written by a transaction spending `signer`'s cell.
function chain(...reports) {
  const transactions = new Map();
  const cells = reports.map(({ signer, data, n }) => {
    const fundingHash = digest(`funding ${n}`);
    const funding = Transaction.default();
    funding.addOutput({ lock: signer, capacity: 1000n }, '0x');
    const writeHash = digest(`write ${n}`);
    const write = Transaction.default();
    write.inputs.push({ previousOutput: { txHash: fundingHash, index: 0 }, since: 0n });
    transactions.set(fundingHash, funding);
    transactions.set(writeHash, write);
    return Cell.from({ outPoint: OutPoint.from({ txHash: writeHash, index: 0 }), cellOutput: { lock: owner, capacity: 1000n }, outputData: data });
  });
  return {
    findCells: async function* () { yield* cells; },
    getTransaction: async (hash) => ({ status: 'committed', transaction: transactions.get(hash) }),
  };
}

test('finds a stolen report the owner signed', async () => {
  const reports = await findStolenReports(chain({ signer: owner, data: encodeReport(id, 'Taken in town'), n: 1 }), passport);
  assert.deepEqual(reports.map((r) => r.note), ['Taken in town']);
});

test('ignores a report someone else put under the owner wallet', async () => {
  assert.equal((await findStolenReports(chain({ signer: stranger, data: encodeReport(id, 'fake'), n: 1 }), passport)).length, 0);
});

test('ignores reports for another passport and bad bytes', async () => {
  const other = encodeReport(`0x${'22'.repeat(68)}`, 'other');
  const bad = `${encodeReport(id)}ff`;
  assert.equal((await findStolenReports(chain({ signer: owner, data: other, n: 1 }, { signer: owner, data: bad, n: 2 }), passport)).length, 0);
});

test('report notes round-trip and stay short', () => {
  assert.equal(decodeNote(encodeReport(id, '  Bag snatched '), id), 'Bag snatched');
  assert.equal(decodeNote(encodeReport(id), id), '');
  assert.throws(() => encodeReport(id, 'x'.repeat(101)), /100 bytes/);
});
