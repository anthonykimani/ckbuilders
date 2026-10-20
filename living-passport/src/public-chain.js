import { CellInput, Script, Transaction } from '@ckb-ccc/core';
import { CAPACITY, decodeRecord, root } from './chain-codec.js';

export function passportType(deployment, args) {
  if (!deployment?.codeHash || !['data', 'data1', 'data2', 'type'].includes(deployment.hashType)
    || !/^0x[0-9a-fA-F]{136}$/.test(args)) throw new Error('Invalid passport contract or ID.');
  return Script.from({ codeHash: deployment.codeHash, hashType: deployment.hashType, args });
}

// Type Script args: 36-byte one-use funding OutPoint, then the workshop Lock hash.
export function workshopLockHash(args) {
  return `0x${args.slice(2 + 72)}`;
}

export async function loadPassport(client, deployment, args) {
  const type = passportType(deployment, args);
  const live = await client.findSingletonCellByType(type, true);
  if (!live) return null;
  const transactions = new Map();
  async function committed(hash) {
    if (!transactions.has(hash)) {
      const result = await client.getTransaction(hash);
      if (result?.status !== 'committed' || !result.transaction) throw new Error('Passport history contains an unconfirmed or missing transaction.');
      transactions.set(hash, Transaction.from(result.transaction));
    }
    return transactions.get(hash);
  }
  let point = live.outPoint;
  const backwards = [];
  for (let step = 0; step < 256; step += 1) {
    const tx = await committed(point.txHash);
    const index = Number(point.index);
    const output = tx.outputs[index];
    if (!output?.type || output.type.hash() !== type.hash()) throw new Error('Passport Type Script changed in its history.');
    const record = decodeRecord(tx.outputsData[index]);
    if (output.lock.hash() !== record.recipientHash || output.capacity < CAPACITY) throw new Error('Passport output does not match its recorded recipient or minimum capacity.');
    backwards.push({ ...record, txHash: point.txHash, outputIndex: index, outputCapacity: output.capacity });
    let predecessor = null;
    for (const inputLike of tx.inputs) {
      const input = CellInput.from(inputLike);
      const previous = input.previousOutput;
      const priorTx = await committed(previous.txHash);
      const priorOutput = priorTx.outputs[Number(previous.index)];
      if (priorOutput?.type?.hash() === type.hash()) {
        if (predecessor) throw new Error('Passport history branches into multiple inputs.');
        predecessor = previous;
      }
    }
    if (!predecessor) break;
    point = predecessor;
    if (step === 255) throw new Error('Passport history exceeds the reader limit.');
  }
  const events = backwards.reverse();
  if (!events.length || events[0].action !== 0 || events[0].sequence !== 0) throw new Error('Passport has no valid creation event.');
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (event.sequence !== i || event.itemId !== events[0].itemId
      || event.historyRoot !== root(i === 0 ? event.itemId : events[i - 1].historyRoot, event.eventHash)
      || (i > 0 && ![1, 2].includes(event.action))) throw new Error('Passport history sequence or root is inconsistent.');
  }
  const latest = events.at(-1);
  if (live.outputData !== txData(latest, await committed(latest.txHash))
    || live.cellOutput.lock.hash() !== latest.recipientHash) throw new Error('The live Cell does not match its confirmed history.');
  if (events.some((event) => event.outputCapacity !== undefined && event.outputCapacity !== live.cellOutput.capacity)) throw new Error('Passport capacity changed in its history.');
  return { id: args, itemId: latest.itemId, workshopLockHash: workshopLockHash(args), ownerLockHash: latest.recipientHash, sequence: latest.sequence, historyRoot: latest.historyRoot, capacity: live.cellOutput.capacity, events };
}

function txData(event, tx) { return tx.outputsData[event.outputIndex]; }

export function passportLink(args) {
  return `${location.origin}${location.pathname}?passport=${encodeURIComponent(args)}`;
}
