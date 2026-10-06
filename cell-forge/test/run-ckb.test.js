import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Transaction, hexFrom, WitnessArgs } from '@ckb-ccc/core';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const compiler = process.env.CELLC || 'cellc';
const artifact = readFileSync(new URL('../build/forge-turn.elf', import.meta.url));
const capacity = 20000000000n;

function u64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}

function data(cell) {
  return '0x' + Buffer.concat([Buffer.from([cell.kind]), u64(cell.units), u64(cell.turn ?? 0)]).toString('hex');
}

function witness(owner, recipe, outputs) {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(outputs.length);
  const plan = '0x' + Buffer.concat([
    Buffer.from('CSBPLv1\0'), count,
    ...outputs.map((cell) => Buffer.concat([
      Buffer.from((cell.recipient ?? owner).slice(2), 'hex'),
      Buffer.from(data(cell).slice(2), 'hex'),
    ])),
  ]).toString('hex');
  const encoded = spawnSync(compiler, [
    'entry-witness', 'src/run.cell', '--action', 'forge_turn',
    '--arg', plan, '--arg', String(recipe), '--json',
  ], { encoding: 'utf8' });
  assert.equal(encoded.status, 0, `${encoded.stdout}\n${encoded.stderr}`);
  const result = JSON.parse(encoded.stdout);
  const inputType = result.witness_hex ?? result.witness ?? result.hex;
  assert.ok(inputType, JSON.stringify(result));
  return hexFrom(new WitnessArgs('0x', inputType, '0x').toBytes());
}

async function verifyTurn(options = {}) {
  const recipe = options.recipe ?? 1;
  const resource = Resource.default();
  const tx = Transaction.default();
  const type = resource.deployCell(hexFrom(artifact), tx, false);
  const lock = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const owner = lock.hash();
  const inputs = options.inputs ?? (recipe === 1 ? [
    { kind: 0, units: 1, turn: 0 },
    { kind: 1, units: 1 },
    { kind: 4, units: 1 },
  ] : [
    { kind: 0, units: 1, turn: 1 },
    { kind: 16, units: 2 },
    { kind: 64, units: 1 },
  ]);
  for (const cell of [...inputs, ...(options.extraInput ? [options.extraInput] : [])]) {
    const mocked = resource.mockCell(lock, type, data(cell), capacity);
    tx.inputs.push(Resource.createCellInput(mocked));
  }
  const next = options.outputs ?? [
    { kind: 0, units: 1, turn: recipe },
    { kind: recipe === 1 ? 16 : 128, units: recipe === 1 ? 2 : 3, turn: 0 },
  ];
  for (const cell of [...next, ...(options.extraOutput ? [options.extraOutput] : [])]) {
    tx.outputs.push(Resource.createCellOutput(lock, type, cell.kind === 0 ? capacity : capacity * 2n));
    tx.outputsData.push(data(cell));
  }
  tx.witnesses.push(witness(owner, recipe, options.witnessOutputs ?? next));
  while (tx.witnesses.length < tx.inputs.length) tx.witnesses.push('0x');
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return { code: results[0].scriptErrorCode, cycles: results[0].stdoutCycles, stdout: results[0].stdout };
}

test('two complete game turns pass CKB-VM Type validation', async () => {
  for (const recipe of [1, 2]) {
    const result = await verifyTurn({ recipe });
    assert.equal(result.code, 0, result.stdout);
    console.log(`turn ${recipe}: ${result.cycles} cycles`);
  }
});

test('run-state and complete group failures are rejected', async () => {
  const cases = [
    ['missing state', { inputs: [{ kind: 1, units: 1 }, { kind: 4, units: 1 }, { kind: 4, units: 1 }] }],
    ['duplicate ore', { inputs: [{ kind: 0, units: 1 }, { kind: 1, units: 1 }, { kind: 1, units: 1 }] }],
    ['extra group input', { extraInput: { kind: 1, units: 1 } }],
    ['extra group output', { extraOutput: { kind: 16, units: 1 } }],
    ['skipped turn', { outputs: [{ kind: 0, units: 1, turn: 2 }, { kind: 16, units: 2 }] }],
    ['wrong product', { outputs: [{ kind: 0, units: 1, turn: 1 }, { kind: 128, units: 2 }] }],
    ['inflated units', { outputs: [{ kind: 0, units: 1, turn: 1 }, { kind: 16, units: 3 }] }],
    ['early assembly', { recipe: 2, inputs: [{ kind: 0, units: 1, turn: 0 }, { kind: 16, units: 2 }, { kind: 64, units: 1 }] }],
  ];
  for (const [name, options] of cases) {
    const result = await verifyTurn(options);
    assert.notEqual(result.code, 0, `${name} unexpectedly passed`);
    console.log(`${name}: rejected with ${result.code} in ${result.cycles} cycles`);
  }
});
