# CellScript Escrow

This is a small CellScript v0.25.0 port of the claim/refund rules in `../cell-escrow/`.

The contract models one pending escrow Cell held by a dedicated `escrow_lock`. The recipient can claim before the refund height with the correct preimage. The payer can refund at or after the refund height. Both actions consume the pending Cell and create a terminal escrow successor locked to the correct party. `std::cell::preserve_capacity` checks that the real CKB input and output capacities match.

## Run

Install the pinned compiler and run:

```bash
cellc --version
cellc build --locked
cellc test --locked --backend all --json
cellc verify-artifact build/main.elf --verify-sources --json
```

## Test boundary

CellScript v0.25.0 can execute no-argument scenarios on both its simulator and CKB-VM runner. Transaction-shaped entries that need Cell data, witnesses and CKB syscalls require a separate stateful harness. The scenarios in `tests/` therefore test the same actor, preimage, timelock and capacity-preservation decisions as the contract, but they are not a devnet deployment or an on-chain transaction test. The `claimed_by` and `refunded_by` values are witness inputs, not cryptographic signature proof; a production version still needs the dedicated lock and signature integration.

## Week 7: transaction-shaped type-script checks

The separate [`test/ckb-transaction.test.js`](test/ckb-transaction.test.js) harness builds mock CKB transactions with a pending escrow input, a funding input, a terminal escrow output, a settlement record output, and a `WitnessArgs.input_type` payload. It executes the compiled **type script** in `ckb-debugger` and checks the result and cycle count. Use Linux/WSL with Node.js, `ckb-debugger` v1.1.1 and the pinned `cellc` v0.25.0:

```bash
cellc src/main.cell --target riscv64-elf --target-profile ckb --entry-action claim -o build/claim.elf
cellc src/main.cell --target riscv64-elf --target-profile ckb --entry-action refund -o build/refund.elf
npm ci
npm run test:ckb
```

Set `CKB_DEBUGGER` to the debugger path if it is not on `PATH`. The mock transaction JSON files are written to ignored `build/` for inspection. The test covers successful claim/refund, wrong actors, wrong preimage, early refund, redirected outputs and reduced escrow capacity.

Important: this harness selects `input.0.type`; it does **not** verify the placeholder lock scripts or full consensus validity. A witness naming the recipient passes the type script even when the funding Cell belongs to an attacker and no recipient signature is supplied. This is a demonstrated authorization gap, not a successful security test. The zero-height refund fixture exercises the refund branch locally; it does not prove a live-chain timelock.

## Status

Local experiment only. The contract has not been deployed to devnet or mainnet and has not been audited.
