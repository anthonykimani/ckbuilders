import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, initialRun } from '../src/rules.js';

const start = () => initialRun('run-1', 'alice');
const smelt = () => ({
  recipe: 'smelt',
  inputs: ['state-0', 'ore-0', 'coal-0'],
  outputs: [
    { id: 'state-1', kind: 'State', runId: 'run-1', owner: 'alice', capacity: 100, turn: 1 },
    { id: 'bar-1', kind: 'Bar', runId: 'run-1', owner: 'alice', capacity: 200 },
  ],
});
const assemble = () => ({
  recipe: 'assemble',
  inputs: ['state-1', 'bar-1', 'wood-0'],
  outputs: [
    { id: 'state-2', kind: 'State', runId: 'run-1', owner: 'alice', capacity: 100, turn: 2 },
    { id: 'pickaxe-2', kind: 'Pickaxe', runId: 'run-1', owner: 'alice', capacity: 300 },
  ],
});

test('smelt then assemble completes the solo puzzle', () => {
  const afterSmelt = applyMove(start(), smelt());
  assert.equal(afterSmelt.complete, false);
  assert.deepEqual(afterSmelt.live.map((cell) => cell.kind).sort(), ['Bar', 'State', 'Wood']);
  const finished = applyMove(afterSmelt, assemble());
  assert.equal(finished.complete, true);
  assert.deepEqual(finished.live.map((cell) => cell.kind).sort(), ['Pickaxe', 'State']);
});

test('rejects malformed input and output groups', () => {
  const cases = [
    [(move) => { move.inputs = ['state-0', 'ore-0', 'ore-0']; }, /duplicate input/],
    [(move) => { move.inputs = ['ore-0', 'coal-0', 'wood-0']; }, /expected one state input/],
    [(move) => { move.inputs = ['state-0', 'ore-0', 'wood-0']; }, /wrong ingredients/],
    [(move) => { move.outputs.push({ ...move.outputs[1], id: 'extra' }); }, /expected state and one product/],
    [(move) => { move.outputs = [move.outputs[1], { ...move.outputs[1], id: 'bar-2' }]; }, /expected one state successor/],
    [(move) => { move.outputs[0].turn = 2; }, /turn must increase by one/],
    [(move) => { move.outputs[0].owner = 'mallory'; }, /output identity changed/],
    [(move) => { move.outputs[1].runId = 'other-run'; }, /output identity changed/],
    [(move) => { move.outputs[1].kind = 'Pickaxe'; }, /wrong product/],
    [(move) => { move.outputs[1].capacity = 199; }, /ingredient capacity changed/],
    [(move) => { move.outputs[0].capacity = 99; }, /state capacity changed/],
  ];
  for (const [mutate, error] of cases) {
    const move = smelt();
    mutate(move);
    assert.throws(() => applyMove(start(), move), error);
  }
});

test('spent inputs cannot be used again', () => {
  const afterSmelt = applyMove(start(), smelt());
  assert.throws(() => applyMove(afterSmelt, smelt()), /input is not live/);
});
