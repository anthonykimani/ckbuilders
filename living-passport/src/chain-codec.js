import { hashCkb, hexFrom } from '@ckb-ccc/core';

export const CAPACITY = 60_000_000_000n;
const bytes = (hex) => Buffer.from(hex.slice(2), 'hex');
export const root = (previous, eventHash) => hashCkb(Buffer.concat([bytes(previous), bytes(eventHash)]));

export function encodeEvent({ action, sequence, itemId, actorHash, recipientHash, detail }) {
  const description = Buffer.from(detail.trim(), 'utf8');
  if (![0, 1, 2].includes(action) || !Number.isInteger(sequence) || sequence < 0 || sequence > 0xffffffff
    || description.length < 1 || description.length > 160) throw new Error('Invalid event details (1–160 UTF-8 bytes).');
  for (const value of [itemId, actorHash, recipientHash]) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('Invalid event Lock or item hash.');
  }
  const event = Buffer.alloc(102 + description.length);
  event[0] = action;
  event.writeUInt32LE(sequence, 1);
  bytes(itemId).copy(event, 5);
  bytes(actorHash).copy(event, 37);
  bytes(recipientHash).copy(event, 69);
  event[101] = description.length;
  description.copy(event, 102);
  return event;
}

export function encodeRecord({ action, sequence, itemId, previousRoot, actorHash, recipientHash, detail }) {
  const event = encodeEvent({ action, sequence, itemId, actorHash, recipientHash, detail });
  const eventHash = hashCkb(event);
  const historyRoot = root(previousRoot, eventHash);
  const data = Buffer.alloc(102 + event.length);
  data[0] = 1;
  data[1] = action;
  data.writeUInt32LE(sequence, 2);
  bytes(itemId).copy(data, 6);
  bytes(historyRoot).copy(data, 38);
  bytes(eventHash).copy(data, 70);
  event.copy(data, 102);
  return { action, sequence, itemId, historyRoot, eventHash, actorHash, recipientHash, detail, data: hexFrom(data) };
}
