import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Transaction, hexFrom } from '@ckb-ccc/core';

const { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS } = createRequire(import.meta.url)('ckb-testtool');
const binary = readFileSync(new URL('../rust-contract/target/riscv64imac-unknown-none-elf/release/cell-forge-type', import.meta.url));
const cap = 20_000_000_000n;

function data(kind, units, turn = 0) {
  const fields = Buffer.alloc(17);
  fields[0] = kind;
  fields.writeBigUInt64LE(BigInt(units), 1);
  fields.writeBigUInt64LE(BigInt(turn), 9);
  return hexFrom(fields);
}

const state = (turn) => ({ kind: 0, units: 1, turn, capacity: cap });
const ore = { kind: 1, units: 1, capacity: cap };
const coal = { kind: 4, units: 1, capacity: cap };
const bar = { kind: 16, units: 2, capacity: cap * 2n };
const wood = { kind: 64, units: 1, capacity: cap };
const pickaxe = { kind: 128, units: 3, capacity: cap * 3n };

async function verifyCase({ inputs = [], outputs = [], bootstrap = false, wrongId = false, redirected = false }) {
  const resource = Resource.default();
  const tx = Transaction.default();
  const deployed = resource.deployCell(hexFrom(binary), tx, false);
  const owner = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
  const funding = resource.mockCell(owner, undefined, '0x', cap * 4n + 100_000_000n);
  const type = deployed.clone();
  type.args = wrongId ? '0x' + 'ab'.repeat(36) : hexFrom(funding.outPoint.toBytes());
  const recipient = redirected ? owner.clone() : owner;
  if (redirected) recipient.args = '0x01';

  if (bootstrap) {
    tx.inputs.push(Resource.createCellInput(funding));
  } else {
    for (const cell of inputs) {
      const mocked = resource.mockCell(owner, type, data(cell.kind, cell.units, cell.turn), cell.capacity);
      tx.inputs.push(Resource.createCellInput(mocked));
    }
  }
  for (const cell of outputs) {
    tx.outputs.push(Resource.createCellOutput(recipient, type, cell.capacity));
    tx.outputsData.push(data(cell.kind, cell.units, cell.turn));
  }
  if (!bootstrap && inputs.length === 2 && outputs.length === 0) {
    // Close releases the 800 CKB game group into an ordinary wallet Cell,
    // less a nominal fee. This output is outside the Type Script group.
    tx.outputs.push(Resource.createCellOutput(owner, undefined, cap * 4n - 100_000_000n));
    tx.outputsData.push('0x');
  }
  const verifier = Verifier.from(resource, tx);
  verifier.setWasmDebuggerEnabled(true);
  const results = await verifier.verify({ codeHash: type.hash() });
  assert.equal(results.length, 1);
  return results[0];
}

test('Rust Type Script accepts start, both moves, and close', async () => {
  const cases = [
    ['start', { bootstrap: true, outputs: [state(0), ore, coal, wood] }],
    ['smelt', { inputs: [state(0), ore, coal], outputs: [state(1), bar] }],
    ['assemble', { inputs: [state(1), bar, wood], outputs: [state(2), pickaxe] }],
    ['close', { inputs: [state(2), pickaxe] }],
  ];
  for (const [name, scenario] of cases) {
    const result = await verifyCase(scenario);
    assert.equal(result.scriptErrorCode, 0, `${name}: ${result.stdout}`);
    console.log(`${name}: ${result.stdoutCycles} cycles`);
  }
});

test('Rust Type Script rejects forged starts and invalid moves', async () => {
  const cases = [
    ['wrong run id', { bootstrap: true, wrongId: true, outputs: [state(0), ore, coal, wood] }],
    ['missing starter', { bootstrap: true, outputs: [state(0), ore, coal] }],
    ['redirected start', { bootstrap: true, redirected: true, outputs: [state(0), ore, coal, wood] }],
    ['duplicate ore', { inputs: [state(0), ore, ore], outputs: [state(1), bar] }],
    ['extra group input', { inputs: [state(0), ore, coal, wood], outputs: [state(1), bar] }],
    ['skipped turn', { inputs: [state(0), ore, coal], outputs: [state(2), bar] }],
    ['wrong product', { inputs: [state(0), ore, coal], outputs: [state(1), pickaxe] }],
    ['extra group output', { inputs: [state(0), ore, coal], outputs: [state(1), bar, ore] }],
    ['redirected move', { inputs: [state(0), ore, coal], redirected: true, outputs: [state(1), bar] }],
    ['capacity inflation', { inputs: [state(0), ore, coal], outputs: [state(1), { ...bar, capacity: cap * 3n }] }],
    ['early close', { inputs: [state(1), bar] }],
  ];
  for (const [name, scenario] of cases) {
    const result = await verifyCase(scenario);
    assert.notEqual(result.scriptErrorCode, 0, `${name} unexpectedly passed`);
    console.log(`${name}: rejected with ${result.scriptErrorCode}`);
  }
});
