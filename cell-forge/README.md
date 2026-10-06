# Cell Forge

Cell Forge is a solo CKB Cell puzzle. The first level is Ore + Coal → Bar, then Bar + Wood → Pickaxe. This repository is at the **contract experiment** stage, not a playable testnet game.

You can already play the two-turn puzzle locally with `npm run play`. This has no wallet or chain interaction; it uses the same reference rules as the tests. Choose two ingredient Cell IDs when prompted.

The dependency-free JavaScript model in `src/rules.js` describes the two-turn puzzle, including a run-state Cell. `src/forge.cell` verifies one pair recipe. The more complete `src/run.cell` consumes exactly one state Cell and two ingredients, then creates the next state Cell and product. Both use CellScript v0.31.0 `BoundedCellSet` and `BoundedList`, so extra Cells in the current Type Script group are rejected. `units` are game quantities, **not CKB capacity**. The artifacts enforce a 200 CKB output capacity floor; they do not prove exact CKB capacity conservation.

## Reproduce the current tests

Use WSL/Linux with Node.js 22 and CellScript `cellc` v0.31.0 on `PATH`. Set `CELLC` to its full path if needed. The version is pinned because later compilers may generate different artifacts.

```bash
npm ci
cellc --version  # must report 0.31.0
cellc src/forge.cell --target riscv64-elf --target-profile ckb --entry-action forge_pair -o build/forge-pair.elf
cellc src/run.cell --target riscv64-elf --target-profile ckb --entry-action forge_turn -o build/forge-turn.elf
cellc experimental/bootstrap-min.cell --target riscv64-elf --target-profile ckb --entry-action bootstrap_probe -o build/bootstrap-min.elf
cellc verify-artifact build/forge-pair.elf --verify-sources --json
cellc verify-artifact build/forge-turn.elf --verify-sources --json
cellc verify-artifact build/bootstrap-min.elf --verify-sources --json
npm test
```

The CKB tests use `ckb-testtool`'s WASM CKB-VM debugger on mock transactions. They validate the Type Script, not a real wallet Lock, full node admission, or public testnet deployment. The input Lock fixture is `alwaysSuccess`; it must not be used to hold valuable assets. The policy also allows the signed transaction to choose different recipient Locks for the two outputs. A minimal output-only bootstrap now compiles and passes mock CKB-VM tests, but it has a **different Type Script identity** from the crafting artifact, so its Cells cannot be used to start the game. The full game still needs a single verified bootstrap-and-turn policy, secure run identity, and real wallet/node acceptance before anyone can play it on testnet. The attempted one-entry policy in `experimental/` currently fails CellScript's artifact-verification gate; it is not deployable.

Current local result: the pair policy passes two valid recipe cases and rejects eight malformed cases; the run policy passes both turns and rejects eight malformed cases. Pair successes measured 22,313 cycles; run successes measured 21,459 cycles. The verified run artifact is 5,968 bytes, hash `3f6ef368861a7bcf42f0bd2bfe3f8118b9c2b6850ccf4845de0b1b32c0bf0ad9`. These measurements are specific to the current mock fixtures and will be regenerated if the contract changes.
