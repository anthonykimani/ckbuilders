import test from 'node:test';
import assert from 'node:assert/strict';
import { createPassport, addRepair, transferPassport } from '../src/passport.js';

const seed = Buffer.alloc(32, 3);

test('local draft records a hash-linked laptop lifecycle', () => {
  const first = createPassport({ model: 'ThinkPad T480', owner: 'Amina', repairer: 'Repair Works' }, seed);
  const repaired = addRepair(first, { detail: 'Replaced the battery', workshop: 'Repair Works' });
  const transferred = transferPassport(repaired, { nextOwner: 'Otieno' });
  assert.equal(transferred.sequence, 2);
  assert.equal(transferred.events.length, 3);
  assert.equal(transferred.owner, 'Otieno');
  assert.equal(transferred.events[1].previousRoot, first.historyRoot);
  assert.equal(transferred.events[2].previousRoot, repaired.historyRoot);
  assert.notEqual(first.historyRoot, transferred.historyRoot);
});

test('local draft rejects blank details and false workshop label', () => {
  const first = createPassport({ model: 'ThinkPad T480', owner: 'Amina', repairer: 'Repair Works' }, seed);
  assert.throws(() => addRepair(first, { detail: '', workshop: 'Repair Works' }), /Describe/);
  assert.throws(() => addRepair(first, { detail: 'Battery', workshop: 'Other Shop' }), /workshop named/);
  assert.throws(() => transferPassport(first, { nextOwner: 'Amina' }), /different new owner/);
});
