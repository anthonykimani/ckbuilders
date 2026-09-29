import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectTransaction, isTransactionHash } from '../inspector.js';

const hash = `0x${'aa'.repeat(32)}`;
const previousHash = `0x${'bb'.repeat(32)}`;
const lock = { code_hash: `0x${'cc'.repeat(32)}`, hash_type: 'type', args: '0x' };
const transaction = { hash, inputs: [{ previous_output: { tx_hash: previousHash, index: '0x0' }, since: '0x0' }], outputs: [{ capacity: '0x174876e800', lock, type: null }], outputs_data: ['0x'] };
const previous = { outputs: [{ capacity: '0x174876e864', lock, type: null }], outputs_data: ['0x1234'] };
const rpc = async (_method, [txHash]) => txHash === hash ? { transaction, tx_status: { status: 'committed' } } : { transaction: previous };

test('validates hashes', () => { assert.equal(isTransactionHash(hash), true); assert.equal(isTransactionHash('0x123'), false); });
test('reconstructs spent and created Cells and fee', async () => {
  const result = await inspectTransaction(rpc, hash);
  assert.equal(result.inputs.length, 1);
  assert.equal(result.outputs.length, 1);
  assert.equal(result.inputs[0].dataBytes, 2);
  assert.equal(result.fee, '100');
  assert.equal(result.status, 'committed');
});
test('does not invent a fee when previous Cell is unavailable', async () => {
  const result = await inspectTransaction(async (_method, [txHash]) => txHash === hash ? { transaction } : null, hash);
  assert.equal(result.fee, null);
  assert.equal(result.inputTotal, null);
  assert.equal(result.unresolved, 1);
});
test('reports a missing transaction', async () => { await assert.rejects(inspectTransaction(async () => null, hash), /not found/); });
