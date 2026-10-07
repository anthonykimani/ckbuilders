// The game-cell group is reconstructed from scripts/devnet-run.mjs and DEVNET.md.
// It is not an RPC export or an instruction-by-instruction VM trace.
export const smeltReplay = Object.freeze({
  hash: '0xb03f3ff8a8b6b4e86b4740289ce59b52f61848b4396769b6ab5979ed2eb14b51',
  sourceHash: '0x4d277c76dc3ba55bdd29001a6fe0957f67481a8b77229b851a67fe9198f58b21',
  source: 'Reconstructed from the committed transaction hash and the local devnet runner; raw RPC transaction JSON was not exported.',
  inputs: [
    { kind: 'State', units: 1, turn: 0, capacity: 200, outpointIndex: 0 },
    { kind: 'Ore', units: 1, capacity: 200, outpointIndex: 1 },
    { kind: 'Coal', units: 1, capacity: 200, outpointIndex: 2 },
  ],
  outputs: [
    { kind: 'State', units: 1, turn: 1, capacity: 200, outpointIndex: 0 },
    { kind: 'Bar', units: 2, capacity: 400, outpointIndex: 1 },
  ],
});

export const replaySteps = Object.freeze([
  { label: 'Before', title: 'Three live Cells enter', detail: 'The transaction references the run-state, Ore, and Coal Cells created at the start of this local run.' },
  { label: 'Check', title: 'The recipe is checked', detail: 'The Rust Type Script checks the State + Ore + Coal transition. This is a conceptual checkpoint, not a CKB-VM execution trace.' },
  { label: 'Spend', title: 'Inputs become spent', detail: 'Once the transaction commits, these three input outpoints cannot be spent again.' },
  { label: 'Create', title: 'A new State and Bar appear', detail: 'The game Type Script group preserves 600 CKB of capacity: 200 in State and 400 in Bar. Other wallet fee/change Cells are outside this view.' },
]);

export function capacityTotal(cells) {
  return cells.reduce((total, cell) => total + cell.capacity, 0);
}

export function replayStep(index) {
  if (!Number.isInteger(index) || index < 0 || index >= replaySteps.length) throw new RangeError('Invalid replay step');
  return replaySteps[index];
}
