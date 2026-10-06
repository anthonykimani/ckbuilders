# Local devnet run

On 7 October 2026 I ran the Rust Cell Forge Type Script on an isolated OffCKB `ckb_dev` chain. This was a full-node transaction test with the standard secp256k1 Lock and a public OffCKB development key, not just a CKB-VM mock. The devnet was OffCKB CLI 0.4.13 with CKB 0.208.0. It used a separate data directory under `/tmp` and localhost RPC.

| Step | Committed transaction |
| --- | --- |
| Deploy immutable Rust code Cell | `0xcb2001b4703401131ea088f61248dec086fd0dc73e485aad6458f22048559e27` |
| Start: State + Ore + Coal + Wood | `0x4d277c76dc3ba55bdd29001a6fe0957f67481a8b77229b851a67fe9198f58b21` |
| Smelt: Ore + Coal → Bar | `0xb03f3ff8a8b6b4e86b4740289ce59b52f61848b4396769b6ab5979ed2eb14b51` |
| Assemble: Bar + Wood → Pickaxe | `0x32fcc9d6ad2e11633c09b5d0c67471fa4398313672f96b0ca77433c4dbc6e05c` |
| Close: spend State + Pickaxe, return capacity to a normal wallet Cell | `0x9f1b061882e7f4dddfa8a1ec6a28fe51e5601d82569ef778b42c44e7bfc77e4a` |

The code hash was `0x2a02bf1920e5152de39827ebcaffe3f2167fc25ee4f6f5e93cc0e7a1d284cd4f`. The runner waited for each transaction to be included in a block before spending its outputs in the next step. The same Type Script identity handled start, both moves, and close. These hashes belong only to this local chain; they are **not** public testnet transactions or explorer links.

I also queried the close transaction back from the node. Its status was `committed`; it had one ordinary output with no Type Script and `799.99999563` CKB capacity, returning the game's 800 CKB less the transaction fee to the development wallet Lock.

## Reproduce on a fresh local devnet

Build `rust-contract` as described in its README. Install OffCKB CLI 0.4.13 with Node.js 22, start a fresh pure devnet, and deploy `rust-contract/target/riscv64imac-unknown-none-elf/release/cell-forge-type` without Type ID. OffCKB writes a `scripts.json` deployment file. The runner also needs the bundled OffCKB `account/keys` file; it reads the first public development key locally and never prints it.

From `cell-forge/`:

```bash
CELL_FORGE_DEVNET_KEYS=/path/to/@offckb/cli/account/keys \
CELL_FORGE_DEVNET_DEPLOYMENT=/path/to/deployment/scripts.json \
node scripts/devnet-run.mjs
```

The runner refuses a non-local RPC URL or a chain whose name does not contain `dev`. Its standard Lock CellDep is pinned to the OffCKB devnet used here; verify it against `offckb system-scripts --export-style ccc` if your devnet version differs. It does not use a real wallet seed or testnet account. Do not use OffCKB's development keys on a public network.
