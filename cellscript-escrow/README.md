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

## Status

Local experiment only. The contract has not been deployed to devnet or mainnet and has not been audited.
