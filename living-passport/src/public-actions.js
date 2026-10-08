import { Address, CellInput, Transaction, bytesConcat, bytesFrom, hashCkb, hexFrom } from '@ckb-ccc/core';
import { CAPACITY, encodeRecord } from './chain-codec.js';
import { passportType } from './public-chain.js';

function text(value, max = 160) {
  const trimmed = String(value ?? '').trim();
  const size = new TextEncoder().encode(trimmed).length;
  if (!size || size > max) throw new Error(`Enter 1–${max} UTF-8 bytes.`);
  return trimmed;
}

function testnet(signer) {
  if (!signer || signer.client.addressPrefix !== 'ckt') throw new Error('Connect a CKB testnet wallet first. Do not use a mainnet or exchange address.');
}

function addInput(tx, cell) {
  tx.inputs.push(CellInput.from({ previousOutput: cell.outPoint, cellOutput: cell.cellOutput, outputData: cell.outputData }));
}

function cellDep(deployment) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployment?.txHash ?? '') || !Number.isInteger(deployment?.index)) throw new Error('The public-testnet contract is not deployed yet.');
  return { outPoint: { txHash: deployment.txHash, index: deployment.index }, depType: 'code' };
}

async function pureCell(signer, minimum) {
  for await (const cell of signer.findCells({ scriptLenRange: [0, 1], outputDataLenRange: [0, 1] }, true, 'asc', 1)) {
    if (cell.cellOutput.capacity >= minimum) return cell;
  }
  throw new Error('No plain testnet CKB Cell with enough capacity. Fund your wallet from the testnet faucet.');
}

async function submit(signer, tx) {
  await tx.completeFeeBy(signer);
  const hash = await signer.sendTransaction(tx);
  const confirmed = await signer.client.waitTransaction(hash, 0, 120000, 2000);
  if (!confirmed) throw new Error(`Submitted ${hash}, but confirmation timed out. Check the explorer before retrying.`);
  return hash;
}

export async function createPassport(signer, deployment, { model, owner, workshopAddress }) {
  testnet(signer);
  const description = `${text(model, 80)} / ${text(owner, 60)}`;
  const workshop = await Address.fromString(workshopAddress.trim(), signer.client);
  const ownerLock = (await signer.getRecommendedAddressObj()).script;
  const funding = await pureCell(signer, CAPACITY + 100_000_000n);
  const random = crypto.getRandomValues(new Uint8Array(16));
  const itemId = hashCkb(bytesConcat(bytesFrom(funding.outPoint.toBytes()), random));
  const args = hexFrom(bytesConcat(bytesFrom(funding.outPoint.toBytes()), bytesFrom(workshop.script.hash())));
  const type = passportType(deployment, args);
  const record = encodeRecord({ action: 0, sequence: 0, itemId, previousRoot: itemId, actorHash: ownerLock.hash(), recipientHash: ownerLock.hash(), detail: description });
  const tx = Transaction.default();
  addInput(tx, funding);
  tx.addOutput({ lock: ownerLock, type, capacity: CAPACITY }, record.data);
  tx.cellDeps.push(cellDep(deployment));
  const txHash = await submit(signer, tx);
  return { args, txHash };
}

export async function transferPassport(signer, deployment, passport, { recipientAddress, note }) {
  testnet(signer);
  const type = passportType(deployment, passport.id);
  const oldCell = await signer.client.findSingletonCellByType(type, true);
  if (!oldCell) throw new Error('The passport Cell is no longer live. Reload its history.');
  const ownerLock = (await signer.getRecommendedAddressObj()).script;
  if (oldCell.cellOutput.lock.hash() !== ownerLock.hash() || ownerLock.hash() !== passport.ownerLockHash) throw new Error('This wallet is not the current owner.');
  const recipient = await Address.fromString(recipientAddress.trim(), signer.client);
  if (recipient.script.hash() === ownerLock.hash()) throw new Error('Choose a different recipient.');
  const record = encodeRecord({ action: 2, sequence: passport.sequence + 1, itemId: passport.itemId, previousRoot: passport.historyRoot, actorHash: ownerLock.hash(), recipientHash: recipient.script.hash(), detail: text(note) });
  const tx = Transaction.default();
  addInput(tx, oldCell);
  tx.addOutput({ lock: recipient.script, type, capacity: oldCell.cellOutput.capacity }, record.data);
  tx.cellDeps.push(cellDep(deployment));
  return submit(signer, tx);
}
