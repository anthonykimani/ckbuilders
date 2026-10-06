import test from 'node:test';
import assert from 'node:assert/strict';
import { initialRun } from '../src/rules.js';
import { craftChoice } from '../src/session.js';

test('player can solve the two-turn puzzle without another player', () => {
  const first = craftChoice(initialRun('practice', 'alice'), ['ore-0', 'coal-0']);
  assert.deepEqual(first.proposal.inputs, ['state-0', 'ore-0', 'coal-0']);
  assert.equal(first.next.complete, false);
  const second = craftChoice(first.next, ['bar-1', 'wood-0']);
  assert.equal(second.next.complete, true);
  assert.deepEqual(second.next.live.map((cell) => cell.kind).sort(), ['Pickaxe', 'State']);
});

test('wrong choices and spent Cells are rejected', () => {
  const run = initialRun('practice', 'alice');
  assert.throws(() => craftChoice(run, ['ore-0', 'wood-0']), /valid recipe/);
  assert.throws(() => craftChoice(run, ['ore-0', 'ore-0']), /two different/);
  assert.throws(() => craftChoice(run, ['state-0', 'coal-0']), /ingredient Cells/);
  const afterSmelt = craftChoice(run, ['ore-0', 'coal-0']).next;
  assert.throws(() => craftChoice(afterSmelt, ['ore-0', 'wood-0']), /live ingredient/);
});
