import { CellInput, Transaction, bytesConcat, bytesFrom, hexFrom } from '@ckb-ccc/core';
import { signedByHolder, submit } from './public-signed.js';

// A stolen report is a plain cell in the current owner's wallet: "LPSTOLEN", the passport ID,
// then an optional note. The passport contract is unchanged. Marking the device recovered
// spends the report, which returns its CKB.
const MAGIC = new TextEncoder().encode('LPSTOLEN');
const MAX_NOTE = 100;

function prefix(passportId) {
  return hexFrom(bytesConcat(MAGIC, bytesFrom(passportId)));
}

export function encodeReport(passportId, note = '') {
  const text = new TextEncoder().encode(String(note).trim());
  if (text.length > MAX_NOTE) throw new Error(`Keep the note under ${MAX_NOTE} bytes.`);
  return hexFrom(bytesConcat(bytesFrom(prefix(passportId)), text));
}

export function decodeNote(data, passportId) {
  const bytes = bytesFrom(data);
  const head = bytesFrom(prefix(passportId));
  if (bytes.length < head.length || hexFrom(bytes.slice(0, head.length)) !== hexFrom(head)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(head.length)).replace(/\p{C}/gu, '').trim(); } catch { return null; }
}

// Reports count only while their Lock still owns the passport, so a hand-over clears them,
// and only if that owner signed them.
export async function findStolenReports(client, passport) {
  if (!passport?.ownerLock) return [];
  const search = {
    script: passport.ownerLock, scriptType: 'lock', scriptSearchMode: 'exact', withData: true,
    filter: { outputData: prefix(passport.id), outputDataSearchMode: 'prefix' },
  };
  const reports = [];
  for await (const cell of client.findCells(search, 'desc', 20)) {
    if (cell.cellOutput.type || cell.cellOutput.lock.hash() !== passport.ownerLockHash) continue;
    const note = decodeNote(cell.outputData, passport.id);
    if (note !== null && await signedByHolder(client, cell).catch(() => false)) reports.push({ note, txHash: cell.outPoint.txHash, cell });
  }
  return reports;
}

async function ownerLock(signer, passport) {
  if (!signer || signer.client.addressPrefix !== 'ckt') throw new Error('Connect a CKB testnet wallet first.');
  const lock = (await signer.getRecommendedAddressObj()).script;
  if (lock.hash() !== passport.ownerLockHash) throw new Error('Only the current owner can do this.');
  return lock;
}

export async function reportStolen(signer, passport, note) {
  const lock = await ownerLock(signer, passport);
  const tx = Transaction.default();
  tx.addOutput({ lock }, encodeReport(passport.id, note));
  return submit(signer, tx);
}

export async function markRecovered(signer, passport, reports) {
  await ownerLock(signer, passport);
  if (!reports.length) throw new Error('This device has no stolen report.');
  const tx = Transaction.default();
  for (const { cell } of reports) tx.inputs.push(CellInput.from({ previousOutput: cell.outPoint, cellOutput: cell.cellOutput, outputData: cell.outputData }));
  return submit(signer, tx);
}
