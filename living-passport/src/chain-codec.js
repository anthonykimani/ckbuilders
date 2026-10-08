import { bytesConcat, bytesFrom, hashCkb, hexFrom } from '@ckb-ccc/core';

export const CAPACITY = 60_000_000_000n;
const bytes = (hex) => bytesFrom(hex);
export const root = (previous, eventHash) => hashCkb(bytesConcat(bytes(previous), bytes(eventHash)));

export function encodeEvent({ action, sequence, itemId, actorHash, recipientHash, detail }) {
  const description = new TextEncoder().encode(detail.trim());
  if (![0, 1, 2].includes(action) || !Number.isInteger(sequence) || sequence < 0 || sequence > 0xffffffff
    || description.length < 1 || description.length > 160) throw new Error('Invalid event details (1–160 UTF-8 bytes).');
  for (const value of [itemId, actorHash, recipientHash]) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('Invalid event Lock or item hash.');
  }
  const event = new Uint8Array(102 + description.length);
  event[0] = action;
  new DataView(event.buffer).setUint32(1, sequence, true);
  event.set(bytes(itemId), 5);
  event.set(bytes(actorHash), 37);
  event.set(bytes(recipientHash), 69);
  event[101] = description.length;
  event.set(description, 102);
  return event;
}

export function encodeRecord({ action, sequence, itemId, previousRoot, actorHash, recipientHash, detail }) {
  const event = encodeEvent({ action, sequence, itemId, actorHash, recipientHash, detail });
  const eventHash = hashCkb(event);
  const historyRoot = root(previousRoot, eventHash);
  const data = new Uint8Array(102 + event.length);
  data[0] = 1;
  data[1] = action;
  new DataView(data.buffer).setUint32(2, sequence, true);
  data.set(bytes(itemId), 6);
  data.set(bytes(historyRoot), 38);
  data.set(bytes(eventHash), 70);
  data.set(event, 102);
  return { action, sequence, itemId, historyRoot, eventHash, actorHash, recipientHash, detail, data: hexFrom(data) };
}

export function decodeRecord(dataHex) {
  const data = bytes(dataHex);
  if (data.length < 205 || data[0] !== 1) throw new Error('Unknown passport data format.');
  const action = data[1];
  const sequence = new DataView(data.buffer, data.byteOffset).getUint32(2, true);
  const itemId = hexFrom(data.slice(6, 38));
  const historyRoot = hexFrom(data.slice(38, 70));
  const eventHash = hexFrom(data.slice(70, 102));
  const event = data.slice(102);
  const detailLength = event[101];
  if (![0, 1, 2].includes(action) || detailLength < 1 || detailLength > 160
    || event.length !== 102 + detailLength || event[0] !== action
    || new DataView(event.buffer, event.byteOffset).getUint32(1, true) !== sequence
    || hexFrom(event.slice(5, 37)) !== itemId || hashCkb(event) !== eventHash) {
    throw new Error('Passport event bytes do not match its header.');
  }
  const detail = new TextDecoder('utf-8', { fatal: true }).decode(event.slice(102));
  return {
    action, sequence, itemId, historyRoot, eventHash,
    actorHash: hexFrom(event.slice(37, 69)),
    recipientHash: hexFrom(event.slice(69, 101)), detail,
  };
}
