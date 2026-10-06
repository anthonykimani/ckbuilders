# Cell Forge Rust Type Script

This is one CKB Type Script for the whole local game lifecycle. It is separate from the CellScript experiment. The compiled code is a RISC-V ELF, and `../test/rust-ckb.test.js` runs it in the `ckb-testtool` CKB-VM debugger.

The script accepts four transaction shapes under one Type Script identity:

| Step | Game inputs | Game outputs |
| --- | --- | --- |
| Start | none | State, Ore, Coal, Wood |
| Smelt | State, Ore, Coal | State turn 1, Bar |
| Assemble | State turn 1, Bar, Wood | State turn 2, Pickaxe |
| Close | State turn 2, Pickaxe | none |

The 36-byte Type Script `args` are the first funding input's OutPoint bytes. The start transaction must spend that exact input, so the same run identity cannot be initialized again. Every game Cell in a run uses the same Type Script and owner Lock hash. Cells use 17 bytes of data: one kind byte, then little-endian `u64` units and turn. The contract checks exact group counts, Cell data, owner Lock hashes, and capacities. Each starter Cell has 200 CKB capacity; crafting merges ingredient capacity into the product, and close releases it from the Type Script group. `units` are game quantities, not CKB.

Build on Linux/WSL with Rust 1.97.1 and `riscv64imac-unknown-none-elf` installed:

```bash
cd cell-forge/rust-contract
cargo build --locked --release
cd ..
npm ci
node --test test/rust-ckb.test.js
```

The build uses `ckb-std` 1.1.0, Clang for its C runtime, and Rust's `lower-atomic` pass. The CKB-VM unit test uses mocked Cells and an `alwaysSuccess` Lock; never use that test Lock for funds. A separate [local devnet run](../DEVNET.md) used a real signed secp256k1 Lock and committed deploy, start, smelt, assemble, and close transactions. No public testnet transaction has been made.
