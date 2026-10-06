// Reference model only. It does not authenticate wallet signatures or prove CKB validity.
export const RECIPES = Object.freeze({
  smelt: { consumes: ['Coal', 'Ore'], creates: 'Bar' },
  assemble: { consumes: ['Bar', 'Wood'], creates: 'Pickaxe' },
});

export function initialRun(runId, owner) {
  if (!runId || !owner) {
    throw new Error('invalid run fixture');
  }
  const cell = (id, kind) => ({ id, kind, runId, owner, units: 1 });
  return {
    runId,
    owner,
    live: [
      { ...cell('state-0', 'State'), turn: 0 },
      cell('ore-0', 'Ore'),
      cell('coal-0', 'Coal'),
      cell('wood-0', 'Wood'),
    ],
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameKinds(actual, expected) {
  return [...actual].sort().join(',') === [...expected].sort().join(',');
}

export function applyMove(run, proposal) {
  const recipe = RECIPES[proposal.recipe];
  assert(recipe, 'unknown recipe');
  assert(Array.isArray(proposal.inputs) && proposal.inputs.length === 3, 'expected state and two ingredients');
  assert(Array.isArray(proposal.outputs) && proposal.outputs.length === 2, 'expected state and one product');
  assert(new Set(proposal.inputs).size === 3, 'duplicate input');

  const live = new Map(run.live.map((cell) => [cell.id, cell]));
  const inputs = proposal.inputs.map((id) => live.get(id));
  assert(inputs.every(Boolean), 'input is not live');
  const stateInputs = inputs.filter((cell) => cell.kind === 'State');
  assert(stateInputs.length === 1, 'expected one state input');
  const ingredients = inputs.filter((cell) => cell.kind !== 'State');
  assert(sameKinds(ingredients.map((cell) => cell.kind), recipe.consumes), 'wrong ingredients');
  assert(inputs.every((cell) => cell.runId === run.runId && cell.owner === run.owner), 'input identity changed');

  const outputs = proposal.outputs;
  assert(outputs.every((cell) => cell && typeof cell.id === 'string' && cell.id.length > 0), 'missing output id');
  assert(new Set(outputs.map((cell) => cell.id)).size === 2, 'duplicate output');
  assert(outputs.every((cell) => !live.has(cell.id)), 'output id already exists');
  assert(outputs.every((cell) => cell.runId === run.runId && cell.owner === run.owner), 'output identity changed');
  assert(outputs.every((cell) => Number.isSafeInteger(cell.units) && cell.units > 0), 'invalid units');

  const nextStates = outputs.filter((cell) => cell.kind === 'State');
  assert(nextStates.length === 1, 'expected one state successor');
  const [nextState] = nextStates;
  assert(nextState.turn === stateInputs[0].turn + 1, 'turn must increase by one');
  assert(nextState.units === stateInputs[0].units, 'state units changed');
  const products = outputs.filter((cell) => cell.kind !== 'State');
  assert(products.length === 1 && products[0].kind === recipe.creates, 'wrong product');
  assert(products[0].units === ingredients.reduce((sum, cell) => sum + cell.units, 0), 'ingredient units changed');

  const spent = new Set(proposal.inputs);
  const next = {
    runId: run.runId,
    owner: run.owner,
    live: [...run.live.filter((cell) => !spent.has(cell.id)), ...outputs.map((cell) => ({ ...cell }))],
  };
  return { ...next, complete: next.live.some((cell) => cell.kind === 'Pickaxe') };
}
