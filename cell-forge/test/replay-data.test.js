import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityTotal, replayStep, replaySteps, smeltReplay } from '../web/replay-data.js';

test('replay reflects the signed smelt game-cell group', () => {
  assert.equal(smeltReplay.inputs.length, 3);
  assert.equal(smeltReplay.outputs.length, 2);
  assert.deepEqual(smeltReplay.inputs.map((cell) => cell.kind), ['State', 'Ore', 'Coal']);
  assert.deepEqual(smeltReplay.outputs.map((cell) => cell.kind), ['State', 'Bar']);
  assert.equal(capacityTotal(smeltReplay.inputs), 600);
  assert.equal(capacityTotal(smeltReplay.outputs), 600);
  assert.equal(smeltReplay.inputs[0].turn + 1, smeltReplay.outputs[0].turn);
  assert.equal(smeltReplay.inputs[1].units + smeltReplay.inputs[2].units, smeltReplay.outputs[1].units);
  assert.equal(smeltReplay.hash, '0xb03f3ff8a8b6b4e86b4740289ce59b52f61848b4396769b6ab5979ed2eb14b51');
});

test('replay has bounded, readable steps', () => {
  assert.equal(replaySteps.length, 4);
  assert.equal(replayStep(3).label, 'Create');
  assert.throws(() => replayStep(4), RangeError);
});
