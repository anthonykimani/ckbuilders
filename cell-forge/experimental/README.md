# Bootstrap experiment — blocked

`game.cell` attempts to combine run initialization (zero game inputs, four game outputs) and both crafting turns (three game inputs, two game outputs) in one Type Script artifact. CellScript v0.31.0 parses it, but compiling the CKB artifact fails with `E2400 / V2420: bounded GroupInput machine contract: bounded Cell syscall a0 is not a canonical stack buffer`.

This is a compiler/artifact-verifier rejection, not evidence that the program would behave correctly on CKB. We did not bypass the check. The earlier `src/run.cell` compiles and its two turns pass mock CKB-VM tests, but it cannot initialize its own game Cells. Public testnet play remains blocked until a bootstrap design passes verified compilation and full transaction tests.

`bootstrap-min.cell` isolates output-only creation. With a bound of three possible GroupInput Cells and four planned GroupOutput Cells, it compiles with v0.31.0, passes local mock CKB-VM validation at 23,227 cycles, and rejects wrong and extra outputs. For an output-only Type Script group, the entry witness is placed in the first transaction witness slot in this fixture. A separate bootstrap artifact is **not** a solution to the game lifecycle: its Type Script code hash differs from `src/run.cell`, so the created Cells cannot be spent by the run policy. The combined source still fails `E2400 / V2420` even when its per-input recipe condition is simplified. No testnet or full-node transaction has been attempted.

## Reduced unified-policy compiler reproducer

`unified-probe.cell` is a smaller, deliberately non-deployable example of the same failure. It uses one artifact for a zero-input/four-output start or a three-input/two-output turn. On CellScript v0.31.0:

```bash
cellc experimental/unified-probe.cell --target riscv64-elf --target-profile ckb --entry-action unified_probe -o build/unified-probe.elf
```

The actual result is `E2400 / V2420: bounded GroupInput machine contract: bounded Cell syscall a0 is not a canonical stack buffer`. A reduced version with input count, recipe-kind checks, and simple output bounds compiled. Adding the complete output multiset/quantity checks made verification fail. Removing the per-position product clauses did not fix it. This is evidence of a compiler/verifier boundary, not a proof that the source is secure or that the compiler has a general zero-input bug. Do not deploy or use the probe's output.
