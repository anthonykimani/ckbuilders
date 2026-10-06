import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { Transaction, hexFrom, WitnessArgs } from '@ckb-ccc/core';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const compiler = process.env.CELLC || '/tmp/cellscript-031/bin/cellc';
const artifact = readFileSync(new URL('../build/forge-pair.elf', import.meta.url));
const zero32 = (byte) => `0x${byte.repeat(32)}`;
const runId = zero32('11');
const otherRun = zero32('22');
const capacity = 20000000000n;

function u64(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
}

function cellData(owner, run, kind, units) {
  return '0x' + Buffer.concat([
    Buffer.from(owner.slice(2), 'hex'),
    Buffer.from(run.slice(2), 'hex'),
    Buffer.from([kind]),
    u64(units),
  ]).toString('hex');
}

function encodeWitness(owner, run, recipe, product) {
  const count = Buffer.alloc(4);
  count.writeUInt32LE(1);
  const plan = '0x' + Buffer.concat([
    Buffer.from('CSBPLv1\0'),
    count,
    Buffer.from(cellData(owner, run, product.kind, product.units).slice(2), 'hex'),
  ]).toString('hex');
  const result = spawnSync(compiler, [
    'entry-witness', 'src/forge.cell', '--action', 'forge_pair',
    '--arg', plan, '--arg', String(recipe), '--arg', run, '--arg', owner, '--json',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const encoded = JSON.parse(result.stdout);
  return encoded;
}

async function verifyPair({ recipe = 1, ingredients, product, extraInput, extraOutput, run = runId, planOwner }) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const type = resource.deployCell(hexFrom(artifact), tx, false);
  const lock = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const owner = lock.hash();
  const initial = ingredients ?? (recipe === 1 ? [
    { kind: 1, units: 1 }, { kind: 2, units: 1 },
  ] : [
    { kind: 3, units: 2 }, { kind: 4, units: 1 },
  ]);
  for (const item of [...initial, ...(extraInput ? [extraInput] : [])]) {
    const cell = resource.mockCell(lock, type, cellData(owner, item.run ?? run, item.kind, item.units), capacity);
    tx.inputs.push(Resource.createCellInput(cell));
  }
  const made = product ?? { kind: recipe === 1 ? 3 : 5, units: recipe === 1 ? 2 : 3 };
  tx.outputs.push(Resource.createCellOutput(lock, type, capacity * 2n));
  tx.outputsData.push(cellData(owner, run, made.kind, made.units));
  if (extraOutput) {
    tx.outputs.push(Resource.createCellOutput(lock, type, capacity));
    tx.outputsData.push(cellData(owner, run, extraOutput.kind, extraOutput.units));
  }
  const encoded = encodeWitness(planOwner ?? owner, run, recipe, made);
  const inputType = encoded.witness_hex ?? encoded.witness ?? encoded.hex;
  assert.ok(inputType, `unknown entry-witness response: ${JSON.stringify(encoded)}`);
  tx.witnesses.push(hexFrom(new WitnessArgs('0x', inputType, '0x').toBytes()));
  while (tx.witnesses.length < tx.inputs.length) tx.witnesses.push('0x');
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return { code: results[0].scriptErrorCode, cycles: results[0].stdoutCycles, stdout: results[0].stdout };
}

test('CKB-VM accepts both two-input recipes', async () => {
  for (const recipe of [1, 2]) {
    const result = await verifyPair({ recipe });
    assert.equal(result.code, 0, result.stdout);
    console.log(`recipe ${recipe}: ${result.cycles} cycles`);
  }
});

test('CKB-VM rejects malformed grouped transactions', async () => {
  const cases = [
    { name: 'duplicate ore', ingredients: [{ kind: 1, units: 1 }, { kind: 1, units: 1 }] },
    { name: 'wrong ingredient', ingredients: [{ kind: 1, units: 1 }, { kind: 4, units: 1 }] },
    { name: 'extra grouped input', extraInput: { kind: 1, units: 1 } },
    { name: 'extra grouped output', extraOutput: { kind: 3, units: 1 } },
    { name: 'wrong product', product: { kind: 5, units: 2 } },
    { name: 'inflated units', product: { kind: 3, units: 3 } },
    { name: 'wrong run', ingredients: [{ kind: 1, units: 1, run: otherRun }, { kind: 2, units: 1 }] },
    { name: 'redirected product', planOwner: zero32('ee') },
  ];
  for (const { name, ...changes } of cases) {
    const result = await verifyPair(changes);
    assert.notEqual(result.code, 0, `${name} unexpectedly passed`);
    console.log(`${name}: rejected with ${result.code} in ${result.cycles} cycles`);
  }
});
