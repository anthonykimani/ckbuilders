import { applyMove, RECIPES } from './rules.js';

export function craftChoice(run, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length !== 2 || new Set(selectedIds).size !== 2) {
    throw new Error('choose two different ingredient Cells');
  }
  const chosen = selectedIds.map((id) => run.live.find((cell) => cell.id === id));
  if (chosen.some((cell) => !cell || cell.kind === 'State')) {
    throw new Error('choose two live ingredient Cells');
  }
  const kinds = chosen.map((cell) => cell.kind).sort().join(',');
  const recipe = Object.entries(RECIPES).find(([, value]) => value.consumes.slice().sort().join(',') === kinds);
  if (!recipe) throw new Error('these ingredients do not make a valid recipe');
  const state = run.live.find((cell) => cell.kind === 'State');
  if (!state) throw new Error('run-state Cell is missing');
  const [name, rule] = recipe;
  const turn = state.turn + 1;
  const proposal = {
    recipe: name,
    inputs: [state.id, ...selectedIds],
    outputs: [
      { ...state, id: `state-${turn}`, turn },
      {
        id: `${rule.creates.toLowerCase()}-${turn}`,
        kind: rule.creates,
        runId: run.runId,
        owner: run.owner,
        units: chosen.reduce((sum, cell) => sum + cell.units, 0),
      },
    ],
  };
  return { proposal, next: applyMove(run, proposal) };
}
