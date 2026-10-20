import { CellInput, KnownScript, Transaction, WitnessArgs, hexFrom, stringify } from '@ckb-ccc/core';
import { decodeRecord, encodeRecord, root } from './chain-codec.js';
import { passportType, workshopLockHash } from './public-chain.js';

// Two-signer repair. The workshop drafts the successor Cell, pays the fee from its own
// input and signs first. The owner checks the draft against the live passport, co-signs
// and submits. Neither signature covers the other party's witness, so the transaction
// hash must be final before the first signature: every Lock's CellDeps and witness
// placeholders are added up front.

const OWNER_WITNESS_PLACEHOLDER = 1000; // JoyID's worst-case unlock size; secp256k1 needs 65.
const REQUEST_VERSION = 1;

function cellDep(deployment) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(deployment?.txHash ?? '') || !Number.isInteger(deployment?.index)) throw new Error('The public-testnet contract is not deployed yet.');
  return { outPoint: { txHash: deployment.txHash, index: deployment.index }, depType: 'code' };
}

function sameOutPoint(a, b) {
  return a.txHash === b.txHash && BigInt(a.index) === BigInt(b.index);
}

async function knownScriptFor(client, lock) {
  for (const name of Object.values(KnownScript)) {
    try {
      const info = await client.getKnownScript(name);
      if (info.codeHash === lock.codeHash && info.hashType === lock.hashType) return name;
    } catch { /* not configured on this network */ }
  }
  return null;
}

async function pureCell(signer, minimum) {
  for await (const cell of signer.findCells({ scriptLenRange: [0, 1], outputDataLenRange: [0, 1] }, true, 'asc', 10)) {
    if (cell.cellOutput.capacity >= minimum) return cell;
  }
  throw new Error('The workshop wallet needs a plain testnet CKB Cell of at least 100 CKB to pay the repair fee.');
}

export async function draftRepair(workshopSigner, deployment, passport, note) {
  if (workshopSigner?.client.addressPrefix !== 'ckt') throw new Error('Connect the workshop’s CKB testnet wallet first.');
  const detail = String(note ?? '').trim();
  const size = new TextEncoder().encode(detail).length;
  if (!size || size > 160) throw new Error('Describe the repair in 1–160 UTF-8 bytes.');
  const client = workshopSigner.client;
  const type = passportType(deployment, passport.id);
  const workshopLock = (await workshopSigner.getRecommendedAddressObj()).script;
  if (workshopLock.hash() !== workshopLockHash(passport.id)) throw new Error('This wallet is not the workshop named on this passport.');
  const oldCell = await client.findSingletonCellByType(type, true);
  if (!oldCell) throw new Error('The passport Cell is no longer live. Reload its history.');
  const ownerLock = oldCell.cellOutput.lock;
  if (ownerLock.hash() === workshopLock.hash()) throw new Error('The workshop already owns this passport; transfer it to the customer first.');
  const ownerScript = await knownScriptFor(client, ownerLock);
  if (!ownerScript) throw new Error('The owner’s wallet type is not supported for co-signing yet.');

  const record = encodeRecord({ action: 1, sequence: passport.sequence + 1, itemId: passport.itemId, previousRoot: passport.historyRoot, actorHash: workshopLock.hash(), recipientHash: ownerLock.hash(), detail });
  const tx = Transaction.default();
  tx.inputs.push(CellInput.from({ previousOutput: oldCell.outPoint, cellOutput: oldCell.cellOutput, outputData: oldCell.outputData }));
  const funding = await pureCell(workshopSigner, 10_000_000_000n);
  tx.inputs.push(CellInput.from({ previousOutput: funding.outPoint, cellOutput: funding.cellOutput, outputData: funding.outputData }));
  tx.addOutput({ lock: ownerLock, type, capacity: oldCell.cellOutput.capacity }, record.data);
  tx.addCellDeps(cellDep(deployment));
  await tx.addCellDepsOfKnownScripts(client, ownerScript);
  tx.setWitnessArgs(0, WitnessArgs.from({ lock: hexFrom(new Uint8Array(OWNER_WITNESS_PLACEHOLDER)) }));
  await tx.completeFeeBy(workshopSigner);
  const signed = await workshopSigner.signOnlyTransaction(tx);
  if (signed.hash() !== tx.hash()) throw new Error('The workshop wallet changed the transaction while signing. Nothing was submitted.');
  return { v: REQUEST_VERSION, passport: passport.id, tx: signed };
}

// --- Share link payload: deflate-raw + base64url of the JSON request. ---

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function base64url(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function unbase64url(text) {
  const raw = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function encodeRequest(request) {
  const json = stringify({ v: request.v, passport: request.passport, tx: request.tx });
  return base64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

export async function decodeRequest(encoded) {
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(await pipe(unbase64url(encoded.trim()), new DecompressionStream('deflate-raw'))));
  } catch {
    throw new Error('This repair link is incomplete or damaged. Ask the workshop to send it again.');
  }
  if (parsed?.v !== REQUEST_VERSION || !/^0x[0-9a-fA-F]{136}$/.test(parsed.passport ?? '')) throw new Error('Unknown repair request format.');
  return { v: parsed.v, passport: parsed.passport, tx: Transaction.from(parsed.tx) };
}

// --- Owner side: everything the owner is about to approve is checked here. ---

export async function reviewRepair(client, deployment, request) {
  const tx = Transaction.from(request.tx);
  const type = passportType(deployment, request.passport);
  const typeHash = type.hash();
  const workshop = workshopLockHash(request.passport);
  if (!tx.cellDeps.some((dep) => sameOutPoint(dep.outPoint, cellDep(deployment).outPoint))) throw new Error('The request does not use the deployed passport contract.');

  const inputs = [];
  for (const input of tx.inputs) {
    const cell = await client.getCell(input.previousOutput);
    if (!cell) throw new Error('A cell used by this request cannot be found on testnet.');
    inputs.push(cell);
  }
  const passportInputs = inputs.filter((cell) => cell.cellOutput.type?.hash() === typeHash);
  if (passportInputs.length !== 1) throw new Error('The request must spend exactly one passport Cell.');
  const old = passportInputs[0];
  const ownerHash = old.cellOutput.lock.hash();
  if (inputs.filter((cell) => cell.cellOutput.lock.hash() === ownerHash).length !== 1) throw new Error('The request would also spend other cells from the owner’s wallet.');
  if (!inputs.some((cell) => cell.cellOutput.lock.hash() === workshop)) throw new Error('The workshop named on this passport is not signing this request.');
  if (!(await client.getCellLive(old.outPoint, false))) throw new Error('This passport has changed since the request was made. Ask the workshop for a fresh link.');

  const outputs = tx.outputs.map((output, index) => ({ output, data: tx.outputsData[index] ?? '0x' })).filter(({ output }) => output.type?.hash() === typeHash);
  if (outputs.length !== 1) throw new Error('The request must create exactly one successor passport.');
  const [{ output, data }] = outputs;
  const before = decodeRecord(old.outputData);
  const after = decodeRecord(data);
  if (after.action !== 1 || after.sequence !== before.sequence + 1 || after.itemId !== before.itemId
    || after.historyRoot !== root(before.historyRoot, after.eventHash)
    || after.actorHash !== workshop || after.recipientHash !== ownerHash
    || output.lock.hash() !== ownerHash || output.capacity !== old.cellOutput.capacity) {
    throw new Error('The repair record does not match this passport. Do not sign it.');
  }
  return { note: after.detail, sequence: after.sequence, ownerLockHash: ownerHash, workshopLockHash: workshop, txHash: tx.hash() };
}

export async function approveRepair(ownerSigner, deployment, request) {
  if (ownerSigner?.client.addressPrefix !== 'ckt') throw new Error('Connect the owner’s CKB testnet wallet first.');
  const client = ownerSigner.client;
  const summary = await reviewRepair(client, deployment, request);
  const ownerLock = (await ownerSigner.getRecommendedAddressObj()).script;
  if (ownerLock.hash() !== summary.ownerLockHash) throw new Error('This wallet is not the current owner of the passport.');
  // Let the owner's wallet size its own witness placeholder (65 bytes for secp256k1,
  // its own format for JoyID). Witnesses are outside the hash the workshop signed;
  // anything that would change the hash itself is caught below.
  const prepared = await ownerSigner.prepareTransaction(Transaction.from(request.tx));
  if (prepared.hash() !== summary.txHash) throw new Error('Your wallet needs to change this transaction before signing (for example a JoyID sub-key). Nothing was submitted.');
  const signed = await ownerSigner.signOnlyTransaction(prepared);
  if (signed.hash() !== summary.txHash) throw new Error('Your wallet changed the transaction while signing. Nothing was submitted.');
  const hash = await client.sendTransaction(signed);
  const confirmed = await client.waitTransaction(hash, 0, 120000, 2000);
  if (!confirmed) throw new Error(`Submitted ${hash}, but confirmation timed out. Check the explorer before retrying.`);
  return hash;
}
