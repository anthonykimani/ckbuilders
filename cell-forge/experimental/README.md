# Bootstrap experiment — blocked

`game.cell` attempts to combine run initialization (zero game inputs, four game outputs) and both crafting turns (three game inputs, two game outputs) in one Type Script artifact. CellScript v0.31.0 parses it, but compiling the CKB artifact fails with `E2400 / V2420: bounded GroupInput machine contract: bounded Cell syscall a0 is not a canonical stack buffer`.

This is a compiler/artifact-verifier rejection, not evidence that the program would behave correctly on CKB. We did not bypass the check. The earlier `src/run.cell` compiles and its two turns pass mock CKB-VM tests, but it cannot initialize its own game Cells. Public testnet play remains blocked until a bootstrap design passes verified compilation and full transaction tests.
