# Cell Forge: functionality plan

Cell Forge is a solo puzzle about consuming ingredient Cells and creating new Cells through valid recipes. The first level starts with Ore, Coal, and Wood. Smelt consumes Ore + Coal to create Bar; Assemble consumes Bar + Wood to create Pickaxe. The goal is to make one Pickaxe in two moves. No asset has monetary value.

## Contract boundary

The wallet Lock authorizes spending each input Cell. A CellScript Type policy must validate the game transition: one run identity, a bounded complete set of game inputs and outputs, one legal recipe, no duplicated ingredients or outputs, no altered owner, and a move count that increases by one. The transaction builder and frontend may preview a move but cannot be the security boundary.

Bootstrap is a separate problem. A run must be uniquely tied to a player's funding input or another verifiable origin; simply letting a frontend declare starting inventory would allow arbitrary forged runs. The exact bootstrap and Lock/Type composition must be proven in full CKB transactions before testnet use.

## Implementation order

1. Build a dependency-free reference rules engine and positive/negative tests. This specifies the puzzle independently of UI and exposes every proposed input/output.
2. Pin CellScript v0.31.0 and implement the Type policy. Compile, inspect metadata and verify the artifact. Test grouped inputs/outputs and malformed transactions in CKB-VM, then compare results with the reference engine.
3. Run full transactions against a local CKB node with real Lock scripts. Only after bootstrap and both puzzle moves pass, create a minimal playable browser flow.
4. Test on public CKB testnet and publish verified transaction links. Keep the interface functional; Flamingo-inspired visual polish comes later.

## First-release limits

One fixed level, one player per run, no trading, token rewards, prize pool, or mainnet deployment. The current CellScript release is an experimental compiler release, not a security audit of our contract. If it cannot enforce the complete game Cell group, stop before public testnet deployment and report the limitation.
