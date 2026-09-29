# CKB Builder Track - Week 7

Prepared: 2026-09-29

## What I tried to answer

My first Week 7 test was too easy. I ran the `claim` and `refund` type scripts separately against mock transactions. Both passed, but that does not mean one escrow Cell has both exits. A CKB Cell has one type Script identity. I had compiled two different ELFs, then manufactured a fresh input Cell for each test.

I went back to the contract and asked a harder question: can I make one escrow Cell that can be claimed or refunded, and can I safely create and spend it on CKB?

## A single settlement entry

I wrote a second, experimental [CellScript entry](../../cellscript-escrow/experimental/settle.cell) called `settle`. A witness byte selects claim or refund. Both branches run from the same compiled ELF and the same type Script identity. Instead of creating a terminal `Escrow` successor, the action consumes the pending escrow and requires an ordinary payout output with the full escrow capacity and the stored recipient or payer lock hash. That avoids leaving the money in a terminal typed Cell with no withdrawal path.

For a claim, the script checks the BLAKE2b preimage. For a refund, it compares the escrow's stored refund epoch with the input's absolute epoch `since`. This is different from the Week 6 `env::current_timepoint()` check. [CellScript's v0.25.0 CKB profile notes](https://github.com/CellScript-Labs/CellScript/blob/v0.25.0/docs/wiki/Tutorial-05-CKB-Target-Profiles.md) say that function reads the epoch number of HeaderDep #0. A transaction can choose an old header dependency, so I cannot use it as proof of the current chain epoch or of a claim cutoff.

The [new test harness](../../cellscript-escrow/test/settle-transaction.test.js) runs the input lock and type script with `ckb-debugger` v1.1.1. The holding lock in this local test is deliberately `alwaysSuccess`. Anyone can submit a valid claim or refund transaction, but the type script is meant to force the payout to the stored lock hash. There is no signer authentication in this design. I am testing the payout rules, not claiming a signed escrow.

## What passed

The claim branch returned 0 at 22,068 type-script cycles, and the refund branch returned 0 at 14,144. The test holding lock used another 539 cycles in each case. Wrong preimage, payout sent to the wrong lock, reduced payout capacity, missing refund `since`, and an invalid branch byte were rejected. The refund test used `since` encoded for epoch 100; removing it produced error 36.

These tests use a single `settle.elf`, unlike my original claim/refund tests. The local mock inputs total 500 CKB; the outputs total 499 CKB, leaving 1 CKB for a fee. These are debugger fixtures, not broadcast transactions or consensus dry runs.

`cellc 0.25.0` built the 30,160-byte ELF. `cellc verify-artifact build/settle.elf --verify-sources --json` reported source binding `verified` and chain evidence `not-provided`.

## What broke

I then added a second escrow input with the *same* type Script to a claim transaction and sent that second Cell's 400 CKB to a different lock. The holding lock and the type script both returned 0. The action only checks `GroupInput #0`; CKB executes the same type Script once for the group, not once per Cell. My second input escaped the capacity and payout checks. This is a serious loss-of-funds path in the experimental design, so it is **not safe to deploy**. It is not a live exploit: this artifact cannot currently create its first escrow Cell. Fixing creation alone, though, would leave this spend path open.

I also tried to create the initial typed escrow Cell from a funding input. The output-only type-script run rejected with error 44 (`CkbSourceViewInvalid`): `settle` expects a group input. The mock harness had manufactured its starting escrow Cell. I do not yet have a creation path that validates on-chain under this same Script identity.

Finally, a claim with `since` set to epoch 101 still passed even though the refund threshold is epoch 100. That is expected for the new design: `since` is a lower bound, and the claim branch has no reliable upper-bound check. After the refund epoch, claim and refund can race. I need to state that plainly instead of promising a strict claim-before-deadline window.

| Adversarial check | Observed result |
| --- | --- |
| Wrong preimage, wrong payout lock, reduced payout, missing refund `since`, invalid branch | Rejected |
| Claim eligible only from epoch 101, with refund epoch 100 | Accepted |
| Two escrow inputs in one type-script group; second payout diverted | **Accepted — unsafe** |
| Create the first typed escrow Cell using this artifact | Rejected |

## What I learned

The exercise changed my view of what “the contract passes” means. A correct branch check is not enough if the Script group can contain an extra Cell or if the first Cell cannot be created. The Week 6 prototype also confused a selectable header epoch with a chain-enforced deadline.

I have left the single-entry version under `experimental/`. The practical blockers are now specific: a creation-and-settlement path under one Script identity, a rule that accounts for every Cell in the Script group, and a decision about whether claim remains possible after the refund epoch. I would ask Arthur about those exact points before treating this as a deployable escrow. The [forum article draft](../../cellscript-escrow/ARTICLE-DRAFT.md) includes the failing fixtures and questions. I have not posted it or deployed anything.
