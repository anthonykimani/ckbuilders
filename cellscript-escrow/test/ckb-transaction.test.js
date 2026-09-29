import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Transaction, WitnessArgs, hexFrom, hashCkb, Script } from '@ckb-ccc/core';
const { Resource, Verifier, createHeaderViewTemplate } = createRequire(import.meta.url)('ckb-testtool');

const bytes32 = (byte) => '0x' + byte.repeat(32);
const u64 = (value) => {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out.toString('hex');
};
const escrowId = bytes32('01');
const preimage = bytes32('11');
const payerLock = new Script(bytes32('a1'), 'data', '0x');
const recipientLock = new Script(bytes32('a2'), 'data', '0x');
const holdingLock = new Script(bytes32('a3'), 'data', '0x');
const attackerLock = new Script(bytes32('a4'), 'data', '0x');
const payer = payerLock.hash();
const recipient = recipientLock.hash();
const escrowLock = holdingLock.hash();
const paymentHash = hashCkb(preimage);
const capacity = 40000000000n;
const recordCapacity = 20000000000n;
const fundingCapacity = recordCapacity + 100000000n;
const refundHeight = 100n;

function escrowData(state, deadline = refundHeight) {
  return '0x' + [escrowId, payer, recipient, escrowLock, paymentHash]
    .map((part) => part.slice(2)).join('') + u64(deadline) + u64(capacity) + state.toString(16).padStart(2, '0');
}

function recordData(actor, action, timepoint) {
  return '0x' + escrowId.slice(2) + action.toString(16).padStart(2, '0') + actor.slice(2) + u64(timepoint);
}

function entryWitness(action, actor, secret = preimage) {
  const payload = '0x' + Buffer.from('CSARGv1\0').toString('hex') +
    (action === 'claim' ? secret.slice(2) : '') + actor.slice(2);
  return hexFrom(new WitnessArgs('0x', payload, '0x').toBytes());
}

function run(name, action, changes = {}, shouldPass = true) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const elf = hexFrom(readFileSync(join('build', `${action}.elf`)));
  const type = resource.deployCell(elf, tx, false);
  const deadline = changes.deadline ?? refundHeight;
  const epoch = changes.epoch ?? (action === 'claim' ? 99n : 100n);
  const actor = changes.actor ?? (action === 'claim' ? recipient : payer);
  const input = resource.mockCell(holdingLock, type, escrowData(0, deadline), capacity);
  const header = createHeaderViewTemplate();
  header.epoch = `0x${epoch.toString(16)}`;
  tx.headerDeps.push(resource.mockHeader(header, '0x', [input]));
  tx.inputs.push(Resource.createCellInput(input));
  const funding = resource.mockCell(changes.fundingLock ?? holdingLock, undefined, '0x', fundingCapacity);
  tx.inputs.push(Resource.createCellInput(funding));
  tx.outputs.push(Resource.createCellOutput(changes.outputLock ?? (action === 'claim' ? recipientLock : payerLock), type, changes.outputCapacity ?? capacity));
  tx.outputsData.push(escrowData(action === 'claim' ? 1 : 2, deadline));
  tx.outputs.push(Resource.createCellOutput(holdingLock, undefined, recordCapacity));
  tx.outputsData.push(recordData(actor, action === 'claim' ? 1 : 2, epoch));
  tx.witnesses.push(entryWitness(action, actor, changes.preimage ?? preimage));
  tx.witnesses.push('0x');
  const verifier = Verifier.from(resource, tx);
  const fixture = join('build', `${name}-tx.json`);
  verifier.dump(fixture);
  assert.ok(tx.inputs.length === 2 && tx.outputs.length === 2);
  assert.ok(capacity + fundingCapacity >= tx.outputs.reduce((sum, cell) => sum + cell.capacity, 0n));
  const result = spawnSync(process.env.CKB_DEBUGGER || 'ckb-debugger',
    ['--mode', 'fast', '--tx-file', fixture, '--script', 'input.0.type'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  const match = output.match(/Run result: (\d+)\s+All cycles: (\d+)/);
  assert.ok(match, `${name}: debugger did not return a script result: ${output}`);
  assert.equal(Number(match[1]) === 0, shouldPass, `${name}: ${output}`);
  console.log(`${name}: ${shouldPass ? 'PASS' : 'REJECT'} (exit ${match[1]}, ${match[2]} cycles)`);
}

run('claim', 'claim');
run('refund', 'refund');
run('wrong-claim-actor', 'claim', { actor: payer }, false);
run('wrong-refund-actor', 'refund', { actor: recipient }, false);
run('wrong-preimage', 'claim', { preimage: bytes32('55') }, false);
run('early-refund', 'refund', { epoch: 99n }, false);
run('redirected-claim', 'claim', { outputLock: payerLock }, false);
run('redirected-refund', 'refund', { outputLock: recipientLock }, false);
run('reduced-capacity', 'claim', { outputCapacity: capacity - 100000000n }, false);
// This passes the type script despite no recipient signature: the claimed_by
// witness names the recipient, but the mock holding lock has no signature check.
run('spoofed-recipient', 'claim', { fundingLock: attackerLock });
