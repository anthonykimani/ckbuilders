import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Transaction, WitnessArgs, hexFrom, hashCkb, Script } from '@ckb-ccc/core';

const { Resource, Verifier, createHeaderViewTemplate, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const b32 = (byte) => '0x' + byte.repeat(32);
const u64 = (number) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(number));
  return bytes.toString('hex');
};
const payerLock = new Script(b32('a1'), 'data', '0x');
const recipientLock = new Script(b32('a2'), 'data', '0x');
const preimage = b32('11');
const capacity = 40000000000n;
const refundEpoch = 100n;
const epochSince = (epoch) => 0x2000010000000000n + BigInt(epoch);

function escrowData() {
  return '0x' + [b32('01'), payerLock.hash(), recipientLock.hash(), hashCkb(preimage)]
    .map((value) => value.slice(2)).join('') + u64(refundEpoch) + u64(capacity);
}

function witness(secret, branch) {
  const payload = '0x' + Buffer.from('CSARGv1\0').toString('hex') + secret.slice(2) + branch.toString(16).padStart(2, '0');
  return hexFrom(new WitnessArgs('0x', payload, '0x').toBytes());
}

function run(name, branch, changes = {}, expected = true) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const elf = hexFrom(readFileSync(join('build', 'settle.elf')));
  const type = resource.deployCell(elf, tx, false);
  const holdingLock = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const escrow = resource.mockCell(holdingLock, type, escrowData(), capacity);
  const funding = resource.mockCell(holdingLock, undefined, '0x', 10000000000n);
  const escrowInput = Resource.createCellInput(escrow);
  escrowInput.since = changes.since ?? (branch === 2 ? epochSince(refundEpoch) : 0n);
  tx.inputs.push(escrowInput, Resource.createCellInput(funding));
  if (changes.extraEscrow) {
    const secondEscrow = resource.mockCell(holdingLock, type, escrowData(), capacity);
    tx.inputs.push(Resource.createCellInput(secondEscrow));
  }
  const header = createHeaderViewTemplate();
  header.epoch = `0x${(changes.headerEpoch ?? 99n).toString(16)}`;
  tx.headerDeps.push(resource.mockHeader(header, '0x', [escrow]));
  tx.outputs.push(Resource.createCellOutput(changes.payoutLock ?? (branch === 1 ? recipientLock : payerLock), undefined, changes.payoutCapacity ?? capacity));
  tx.outputsData.push('0x');
  tx.outputs.push(Resource.createCellOutput(payerLock, undefined, 9900000000n));
  tx.outputsData.push('0x');
  if (changes.extraEscrow) {
    tx.outputs.push(Resource.createCellOutput(new Script(b32('ee'), 'data', '0x'), undefined, capacity));
    tx.outputsData.push('0x');
  }
  tx.witnesses.push(witness(changes.preimage ?? preimage, branch), '0x');
  assert.equal(tx.outputs[0].type, undefined);
  Verifier.from(resource, tx).dump(join('build', `settle-${name}.json`));
  const execute = (script) => {
    const result = spawnSync(process.env.CKB_DEBUGGER || 'ckb-debugger',
      ['--mode', 'fast', '--tx-file', join('build', `settle-${name}.json`), '--script', script], { encoding: 'utf8' });
    if (result.error) throw result.error;
    const match = `${result.stdout}${result.stderr}`.match(/Run result: (\d+)\s+All cycles: (\d+)/);
    assert.ok(match, `${name}/${script}: debugger did not return a script result: ${result.stdout}${result.stderr}`);
    return { exit: Number(match[1]), cycles: Number(match[2]) };
  };
  const lock = execute('input.0.lock');
  const settlement = execute('input.0.type');
  assert.equal(lock.exit, 0, `${name}: holding lock rejected`);
  assert.equal(settlement.exit === 0, expected, `${name}: unexpected type result ${settlement.exit}`);
  const label = changes.unsafe ? 'UNSAFE ACCEPT' : expected ? 'PASS' : 'REJECT';
  console.log(`${name}: ${label} (lock ${lock.exit}/${lock.cycles}, type ${settlement.exit}/${settlement.cycles} cycles)`);
}

run('claim', 1);
run('refund-at-since', 2);
run('bad-preimage', 1, { preimage: b32('55') }, false);
run('redirected-claim', 1, { payoutLock: payerLock }, false);
run('redirected-refund', 2, { payoutLock: recipientLock }, false);
run('reduced-capacity', 1, { payoutCapacity: capacity - 100000000n }, false);
run('refund-without-since', 2, { since: 0n }, false);
run('invalid-branch', 3, {}, false);
run('claim-after-refund-epoch', 1, { headerEpoch: 99n, since: epochSince(101n), unsafe: true });
// This should be rejected by a safe grouped validator, but the current
// single-input action accepts it. The second escrow's capacity can be diverted.
run('batched-escrow-leak', 1, { extraEscrow: true, unsafe: true });

function creationAttempt() {
  const resource = Resource.default();
  const tx = Transaction.default();
  const type = resource.deployCell(hexFrom(readFileSync(join('build', 'settle.elf'))), tx, false);
  const holdingLock = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const funding = resource.mockCell(holdingLock, undefined, '0x', capacity + 100000000n);
  tx.inputs.push(Resource.createCellInput(funding));
  tx.outputs.push(Resource.createCellOutput(holdingLock, type, capacity));
  tx.outputsData.push(escrowData());
  tx.witnesses.push(witness(preimage, 1), witness(preimage, 1));
  Verifier.from(resource, tx).dump(join('build', 'settle-creation-attempt.json'));
  const result = spawnSync(process.env.CKB_DEBUGGER || 'ckb-debugger',
    ['--mode', 'fast', '--tx-file', join('build', 'settle-creation-attempt.json'), '--script', 'output.0.type'],
    { encoding: 'utf8' });
  if (result.error) throw result.error;
  const match = `${result.stdout}${result.stderr}`.match(/Run result: (\d+)\s+All cycles: (\d+)/);
  assert.ok(match, `creation: ${result.stdout}${result.stderr}`);
  assert.notEqual(Number(match[1]), 0, 'output-only creation unexpectedly passed');
  console.log(`creation-attempt: REJECT (type ${match[1]}/${match[2]} cycles)`);
}

creationAttempt();
