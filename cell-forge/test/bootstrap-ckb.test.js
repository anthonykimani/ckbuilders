import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Transaction, hexFrom, WitnessArgs } from '@ckb-ccc/core';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const compiler = process.env.CELLC || 'cellc';
const artifact = readFileSync(new URL('../build/bootstrap-min.elf', import.meta.url));
const capacity = 20000000000n;

function data(cell) {
  const units = Buffer.alloc(8);
  const turn = Buffer.alloc(8);
  units.writeBigUInt64LE(BigInt(cell.units));
  turn.writeBigUInt64LE(BigInt(cell.turn));
  return '0x' + Buffer.concat([Buffer.from([cell.kind]), units, turn]).toString('hex');
}

function witness(owner, outputs) {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(outputs.length);
  const plan = '0x' + Buffer.concat([
    Buffer.from('CSBPLv1\0'), count,
    ...outputs.map((cell) => Buffer.concat([
      Buffer.from(owner.slice(2), 'hex'),
      Buffer.from(data(cell).slice(2), 'hex'),
    ])),
  ]).toString('hex');
  const encoded = spawnSync(compiler, [
    'entry-witness', 'experimental/bootstrap-min.cell', '--action', 'bootstrap_probe',
    '--arg', plan, '--json',
  ], { encoding: 'utf8' });
  assert.equal(encoded.status, 0, `${encoded.stdout}\n${encoded.stderr}`);
  const result = JSON.parse(encoded.stdout);
  const inputType = result.witness_hex ?? result.witness ?? result.hex;
  assert.ok(inputType, JSON.stringify(result));
  return hexFrom(new WitnessArgs('0x', inputType, '0x').toBytes());
}

async function verifyBootstrap(outputs, planned = outputs) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const type = resource.deployCell(hexFrom(artifact), tx, false);
  const lock = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const funding = resource.mockCell(lock, undefined, '0x', capacity * 4n);
  tx.inputs.push(Resource.createCellInput(funding));
  const owner = lock.hash();
  for (const cell of outputs) {
    tx.outputs.push(Resource.createCellOutput(lock, type, capacity));
    tx.outputsData.push(data(cell));
  }
  tx.witnesses.push(witness(owner, planned));
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return results[0];
}

const initial = [0, 1, 4, 64].map((kind) => ({ kind, units: 1, turn: 0 }));

test('minimal output-only bootstrap passes Type Script CKB-VM validation', async () => {
  const result = await verifyBootstrap(initial);
  assert.equal(result.scriptErrorCode, 0, result.stdout);
  console.log(`bootstrap probe: ${result.stdoutCycles} cycles`);
});

test('bootstrap rejects wrong and additional outputs', async () => {
  for (const outputs of [
    initial.map((cell, i) => i === 2 ? { ...cell, kind: 16 } : cell),
    [...initial, { kind: 1, units: 1, turn: 0 }],
  ]) {
    const result = await verifyBootstrap(outputs);
    assert.notEqual(result.scriptErrorCode, 0, 'malformed bootstrap passed');
  }
});
