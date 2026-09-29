# I thought my CellScript escrow worked. Then I put two escrows in one transaction.

I am testing a hash-and-timelock escrow in CellScript `v0.25.0`. My first tests compiled `claim` and `refund` into separate RISC-V ELFs and ran each against a mock CKB transaction. They passed, but I had missed something basic: one deposited Cell has one type Script identity. Two entry binaries are not two exits from the same Cell. My harness had made a different starting Cell for each test.

I tried a single `settle` entry instead. A witness byte chooses claim or refund. The claim checks a BLAKE2b preimage and requires the escrow's capacity to go to the recipient lock hash. Refund requires an absolute epoch `since` at least as high as the stored refund epoch and sends that capacity to the payer lock hash. The output is an ordinary Cell, not an unspendable terminal escrow successor. With a local `alwaysSuccess` holding lock, claim and refund each passed in `ckb-debugger`; wrong preimage, wrong payout lock, reduced payout, missing refund `since`, and an invalid branch were rejected.

The important result came from an extra input. I added a second 400 CKB escrow Cell with the same type Script to a claim transaction and created an extra 400 CKB output to another lock. Both the holding lock and type script returned 0. My action reads `GroupInput #0` and checks one payout output; CKB runs the script once for the type group. The second input was not covered. This is an unsafe design, not a compiler-security claim or a live exploit: the current artifact cannot create its first escrow Cell. Fixing creation alone would leave this spend path open.

I found another gap by trying to create the first escrow Cell. An output-only invocation of my `settle` artifact rejected because the entry expects a group input. The earlier test harness had manufactured the input Cell, so it did not exercise the on-chain creation path.

I also corrected my time model. In the [v0.25.0 CKB target profile](https://github.com/CellScript-Labs/CellScript/blob/v0.25.0/docs/wiki/Tutorial-05-CKB-Target-Profiles.md), `env::current_timepoint()` reads HeaderDep #0's epoch number. It does not prove the current chain tip. An old header can be supplied. `since` gives a chain-enforced *lower* bound for refund, but it cannot give claim a strict upper cutoff. In my new test, a claim eligible only from epoch 101 still passes with a refund epoch of 100. Claim and refund can race after the threshold.

I have kept this version in an `experimental/` folder and will not deploy it. My questions for Arthur and other builders are:

1. What is the intended CellScript v0.25 pattern for a type script that validates both output-only creation and input-side settlement under one Script identity?
2. How should a single-entry action enforce or account for every Cell in its Script group, rather than only `GroupInput #0`?
3. Is a permissionless HTLC with a claim/refund race after `since` the right CKB model here, or should I use a different lock/type composition?

The reproducible source and debugger fixtures are in [`cellscript-escrow/`](./). These are local script runs, not full consensus validation or devnet transactions.
