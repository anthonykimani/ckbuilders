# CKB Builder Track - Week 7

Prepared: 2026-09-29

## What I worked on

Last week I said my CellScript escrow tests did not load real Cell inputs, outputs and witnesses. I wanted to close that gap before writing more about the language. I kept the same `v0.25.0` contract and built mock CKB transactions for its `claim` and `refund` entries.

## The transaction test

The new [test harness](../../cellscript-escrow/test/ckb-transaction.test.js) creates a pending escrow Cell, a separate funding Cell, a terminal escrow output and a settlement record output. It puts the CellScript entry payload inside `WitnessArgs.input_type`, then runs the compiled RISC-V type script with `ckb-debugger` v1.1.1. The two inputs have 601 CKB in total; the outputs have 600 CKB, leaving 1 CKB as a mock fee. I sized the escrow and record outputs above their occupied-capacity needs.

I compiled separate claim and refund entries with `cellc 0.25.0`. The claim ELF is 36,896 bytes and the refund ELF is 16,320 bytes. These are local build files, not deployed code Cells.

## Results

| Case | Type-script result | Cycles |
| --- | --- | ---: |
| Correct claim | Pass | 41,717 |
| Refund at the test deadline | Pass | 27,689 |
| Wrong claim actor | Reject | 14,624 |
| Wrong refund actor | Reject | 8,943 |
| Wrong preimage | Reject | 23,393 |
| Early refund | Reject | 9,602 |
| Claim output sent to payer | Reject | 37,860 |
| Refund output sent to recipient | Reject | 23,832 |
| Escrow output loses 1 CKB | Reject | 39,482 |
| Attacker-funded claim naming recipient, without signature | **Pass** | 41,717 |

I ran these with the native debugger, not the small scenario runner used in Week 6. The correct claim and refund enter the actual compiled contract through CKB syscalls. The rejected cases show the output-lock and capacity checks are present in the generated code, not just in my JavaScript model. The refund tests use deadlines 0 and 100 against the local debugger's timepoint 0; I have not tested a live block-height transition.

## The part that is not safe yet

The last row is the important one. `claimed_by` is a witness value. The type script checks that it equals the recipient stored in the escrow Cell, but it cannot tell who supplied that value. I gave the funding Cell an attacker lock and supplied no recipient signature. The type script still returned 0.

This is not a complete transaction acceptance result: the harness deliberately runs `input.0.type` and does not execute the placeholder lock scripts. It is enough to show that my CellScript type script alone does **not** authenticate the claimant. A real escrow needs a lock design that verifies the right signer for claim and refund, while still allowing the preimage and timelock branches. Until I connect and test that lock, I would not deploy this or call it secure.

I also have not broadcast anything to devnet or mainnet, and I have not run a consensus-level validator or audit. The debugger cycle figures above are for this type script only, not a complete transaction including locks.

## What I learned

The state and output rules survived a more realistic test than last week's typed scenarios. That was useful. But the transaction test also made the authorization issue impossible to miss: checking an address-shaped value in a witness is not checking a signature. The next design decision is the lock/type boundary, not another UI around the escrow.

I wrote a [forum article draft](../../cellscript-escrow/ARTICLE-DRAFT.md) with the exact test shape, numbers and the question I want to ask Arthur. I have not posted it yet.
