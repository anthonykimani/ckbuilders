import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ClientPublicTestnet,
  SignerCkbPrivateKey,
  Transaction,
  Script,
  Cell,
  CellInput,
  OutPoint,
  hexFrom,
} from '@ckb-ccc/core';

const rpcUrl = process.env.CELL_FORGE_DEVNET_RPC ?? 'http://127.0.0.1:8114';
const rpc = new URL(rpcUrl);
if (rpc.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(rpc.hostname)) {
  throw new Error('Refusing to sign outside a local HTTP devnet');
}

const keyFile = process.env.CELL_FORGE_DEVNET_KEYS;
const deploymentFile = process.env.CELL_FORGE_DEVNET_DEPLOYMENT;
if (!keyFile || !deploymentFile) {
  throw new Error('Set CELL_FORGE_DEVNET_KEYS and CELL_FORGE_DEVNET_DEPLOYMENT');
}

const infoResponse = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_blockchain_info', params: [] }),
});
const info = await infoResponse.json();
if (!infoResponse.ok || info.error || !String(info.result?.chain ?? '').includes('dev')) {
  throw new Error(`Refusing non-dev chain: ${info.result?.chain ?? info.error?.message ?? infoResponse.status}`);
}

const privateKey = '0x' + readFileSync(keyFile, 'utf8').trim().split(/\r?\n/)[0].trim();
assert.match(privateKey, /^0x[0-9a-fA-F]{64}$/);
const deployment = JSON.parse(readFileSync(deploymentFile, 'utf8')).devnet['cell-forge-type'];
assert.ok(deployment?.codeHash && deployment?.cellDeps?.length === 1);

const secp = {
  codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
  hashType: 'type',
  cellDeps: [{ cellDep: {
    outPoint: { txHash: '0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293', index: 0 },
    depType: 'depGroup',
  } }],
};
const publicDefaults = new ClientPublicTestnet({ url: rpcUrl, fallbacks: [] });
const client = new ClientPublicTestnet({
  url: rpcUrl,
  fallbacks: [],
  scripts: { ...publicDefaults.scripts, Secp256k1Blake160: secp },
});
const signer = new SignerCkbPrivateKey(client, privateKey);
const { script: owner } = await signer.getRecommendedAddressObj();
assert.equal(owner.codeHash, secp.codeHash);

const cap = 20_000_000_000n;
function data(kind, units, turn = 0) {
  const bytes = Buffer.alloc(17);
  bytes[0] = kind;
  bytes.writeBigUInt64LE(BigInt(units), 1);
  bytes.writeBigUInt64LE(BigInt(turn), 9);
  return hexFrom(bytes);
}

const state = (turn) => ({ kind: 0, units: 1, turn, capacity: cap });
const ore = { kind: 1, units: 1, turn: 0, capacity: cap };
const coal = { kind: 4, units: 1, turn: 0, capacity: cap };
const bar = { kind: 16, units: 2, turn: 0, capacity: cap * 2n };
const wood = { kind: 64, units: 1, turn: 0, capacity: cap };
const pickaxe = { kind: 128, units: 3, turn: 0, capacity: cap * 3n };

function addGameOutput(tx, type, cell) {
  tx.addOutput({ lock: owner, type, capacity: cell.capacity }, data(cell.kind, cell.units, cell.turn));
}

function gameCell(txHash, index, type, cell) {
  return Cell.from({
    outPoint: OutPoint.from({ txHash, index }),
    cellOutput: { lock: owner, type, capacity: cell.capacity },
    outputData: data(cell.kind, cell.units, cell.turn),
  });
}

function addInput(tx, cell) {
  tx.inputs.push(CellInput.from({
    previousOutput: cell.outPoint,
    cellOutput: cell.cellOutput,
    outputData: cell.outputData,
  }));
}

async function send(name, tx) {
  tx.cellDeps.push(deployment.cellDeps[0].cellDep);
  await tx.completeFeeBy(signer, 1000);
  const hash = await signer.sendTransaction(tx);
  const committed = await client.waitTransaction(hash, 0, 120000, 2000);
  if (!committed) throw new Error(`${name} did not commit: ${hash}`);
  console.log(`${name}: ${hash}`);
  return hash;
}

let funding;
for await (const cell of signer.findCells({ scriptLenRange: [0, 1], outputDataLenRange: [0, 1] }, true, 'asc', 1)) {
  funding = cell;
  break;
}
if (!funding || funding.cellOutput.capacity < cap * 4n + 100_000_000n) {
  throw new Error('No sufficiently large pure CKB devnet funding Cell');
}
const type = Script.from({
  codeHash: deployment.codeHash,
  hashType: deployment.hashType,
  args: hexFrom(funding.outPoint.toBytes()),
});

const start = Transaction.default();
addInput(start, funding);
for (const cell of [state(0), ore, coal, wood]) addGameOutput(start, type, cell);
const startHash = await send('start', start);

const smelt = Transaction.default();
for (const cell of [gameCell(startHash, 0, type, state(0)), gameCell(startHash, 1, type, ore), gameCell(startHash, 2, type, coal)]) {
  addInput(smelt, cell);
}
for (const cell of [state(1), bar]) addGameOutput(smelt, type, cell);
const smeltHash = await send('smelt', smelt);

const assemble = Transaction.default();
addInput(assemble, gameCell(smeltHash, 0, type, state(1)));
addInput(assemble, gameCell(smeltHash, 1, type, bar));
addInput(assemble, gameCell(startHash, 3, type, wood));
for (const cell of [state(2), pickaxe]) addGameOutput(assemble, type, cell);
const assembleHash = await send('assemble', assemble);

const close = Transaction.default();
addInput(close, gameCell(assembleHash, 0, type, state(2)));
addInput(close, gameCell(assembleHash, 1, type, pickaxe));
const closeHash = await send('close', close);

console.log(`local chain: ${info.result.chain}; code: ${deployment.codeHash}; close: ${closeHash}`);
