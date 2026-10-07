import { randomBytes } from 'node:crypto';
import { hashCkb, hexFrom } from '@ckb-ccc/core';

const text = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const bytes = (hex) => Buffer.from(hex.slice(2), 'hex');
const root = (previous, eventHash) => hashCkb(Buffer.concat([bytes(previous), bytes(eventHash)]));

function eventHash(event) {
  return hashCkb(new TextEncoder().encode(JSON.stringify(event)));
}

export function createPassport(input, nonce = randomBytes(32)) {
  const model = text(input.model, 80);
  const owner = text(input.owner, 80);
  const repairer = text(input.repairer, 80);
  if (!model || !owner || !repairer) throw new Error('Enter the laptop model, owner and repair workshop.');
  const itemId = hashCkb(Buffer.concat([nonce, Buffer.from(model)]));
  const event = { action: 'mint', model, owner, repairer, note: 'Passport created as a local draft.' };
  const digest = eventHash(event);
  return {
    itemId, model, owner, repairer, sequence: 0,
    historyRoot: root(itemId, digest),
    events: [{ ...event, sequence: 0, eventHash: digest, previousRoot: itemId, historyRoot: root(itemId, digest) }],
  };
}

export function addRepair(passport, input) {
  const detail = text(input.detail, 280);
  const workshop = text(input.workshop, 80);
  if (!detail) throw new Error('Describe the work carried out.');
  if (workshop !== passport.repairer) throw new Error('Use the workshop named when this passport was created.');
  const sequence = passport.sequence + 1;
  const event = { action: 'repair', detail, workshop };
  const digest = eventHash(event);
  const historyRoot = root(passport.historyRoot, digest);
  return {
    ...passport, sequence, historyRoot,
    events: [...passport.events, { ...event, sequence, eventHash: digest, previousRoot: passport.historyRoot, historyRoot }],
  };
}

export function transferPassport(passport, input) {
  const nextOwner = text(input.nextOwner, 80);
  if (!nextOwner || nextOwner === passport.owner) throw new Error('Enter a different new owner.');
  const sequence = passport.sequence + 1;
  const event = { action: 'transfer', from: passport.owner, to: nextOwner };
  const digest = eventHash(event);
  const historyRoot = root(passport.historyRoot, digest);
  return {
    ...passport, owner: nextOwner, sequence, historyRoot,
    events: [...passport.events, { ...event, sequence, eventHash: digest, previousRoot: passport.historyRoot, historyRoot }],
  };
}
