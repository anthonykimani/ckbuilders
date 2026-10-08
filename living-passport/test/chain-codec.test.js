import test from 'node:test';
import assert from 'node:assert/strict';
import { hashCkb, hexFrom } from '@ckb-ccc/core';
import { decodeRecord, encodeRecord, root } from '../src/chain-codec.js';

const id = hashCkb(new TextEncoder().encode('test item'));
const owner = hashCkb(new TextEncoder().encode('owner'));
const workshop = hashCkb(new TextEncoder().encode('workshop'));

test('browser-safe codec round-trips readable UTF-8 and Lock hashes', () => {
  const encoded = encodeRecord({ action: 1, sequence: 7, itemId: id, previousRoot: id, actorHash: workshop, recipientHash: owner, detail: 'Replaced café keyboard' });
  assert.deepEqual(decodeRecord(encoded.data), {
    action: 1, sequence: 7, itemId: id, historyRoot: encoded.historyRoot,
    eventHash: encoded.eventHash, actorHash: workshop, recipientHash: owner,
    detail: 'Replaced café keyboard',
  });
  assert.equal(encoded.historyRoot, root(id, encoded.eventHash));
});

test('codec rejects changed readable bytes and malformed event length', () => {
  const encoded = encodeRecord({ action: 2, sequence: 1, itemId: id, previousRoot: id, actorHash: owner, recipientHash: workshop, detail: 'Transferred' });
  const tampered = Uint8Array.from(Buffer.from(encoded.data.slice(2), 'hex'));
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decodeRecord(hexFrom(tampered)), /do not match/);
  assert.throws(() => decodeRecord(encoded.data.slice(0, -2)), /do not match/);
});
