# Cell Forge

Cell Forge is a solo CKB Cell puzzle. The first level is Ore + Coal → Bar, then Bar + Wood → Pickaxe. This repository is at the **contract experiment** stage, not a playable testnet game.

The dependency-free JavaScript model in `src/rules.js` describes the complete two-turn puzzle, including a run-state Cell. The first CellScript v0.31.0 slice in `src/forge.cell` verifies a single two-input recipe and exactly one output in the current Type Script group. It uses `BoundedCellSet` and `BoundedList`, so an extra Cell in either group must be rejected. `units` are game quantities, **not CKB capacity**. The artifact enforces a 200 CKB output capacity floor; it does not prove exact CKB capacity conservation.

## Reproduce the current tests

Use WSL/Linux with Node.js 22 and CellScript `cellc` v0.31.0. Set `CELLC` if `cellc` is not at `/tmp/cellscript-031/bin/cellc`.

```bash
npm ci
npm test
cellc src/forge.cell --target riscv64-elf --target-profile ckb --entry-action forge_pair -o build/forge-pair.elf
cellc verify-artifact build/forge-pair.elf --verify-sources --json
npm run test:ckb
```

The CKB tests use `ckb-testtool`'s WASM CKB-VM debugger on mock transactions. They validate the Type Script, not a real wallet Lock, full node admission, or public testnet deployment. The input Lock fixture is `alwaysSuccess`; it must not be used to hold valuable assets. Run bootstrap, wallet authorization, live-Cell transitions, capacity, and node acceptance still need separate full-transaction evidence.

Current local result: two valid recipe cases and eight malformed transaction cases passed the CKB-VM harness. The successful cases measured 22,313 cycles each with the v0.31.0 artifact. These measurements are specific to the mock fixtures and will be regenerated when the contract changes.
