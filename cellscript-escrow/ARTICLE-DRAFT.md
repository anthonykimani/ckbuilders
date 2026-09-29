# What happened when I tested a CellScript escrow with mock CKB transactions

I have been rebuilding a small hash-and-timelock escrow in CellScript `v0.25.0`. Last week I could compile it and run the language's scenario tests, but those tests did not put my `claim` or `refund` actions into a transaction. I wanted to know whether the generated RISC-V program checked the same things when it read real CKB inputs, outputs and a witness.

I made a local harness that creates a pending escrow input, a funding input, a settled escrow output and a settlement record. The entry arguments go in `WitnessArgs.input_type`. I then run only the escrow type script with `ckb-debugger` v1.1.1. The input capacity totals 601 CKB and the outputs total 600 CKB, so the mock transaction leaves 1 CKB for fees. This is a local debugger test, not a network transaction.

The claim path passed at 41,717 type-script cycles. The refund path passed at 27,689. Wrong actor values, a wrong preimage, an early refund, redirected settlement outputs and reduced escrow capacity were all rejected. That gives me more confidence that the compiler emitted the checks I wrote in CellScript. The deadlines in this harness are 0 and 100 against a local timepoint of 0; I have not tested a changing chain height.

Then I tried a case that matters more than the happy path. I funded a claim from a Cell with an attacker lock, put the recipient's address in the `claimed_by` witness field, and supplied no recipient signature. The type script passed. It compares the witness value to the escrow's recipient, but that value is not proof of who signed. The harness does not run lock scripts, so this is not a full consensus acceptance claim. It is a clear limit of the type script by itself.

My question for Arthur and other CellScript builders: what lock/type-script arrangement would you use here so either the recipient can claim with the preimage before expiry or the payer can refund after expiry, while the lock actually authenticates the signer? I would especially like to know whether CellScript has a good pattern for sharing the action/witness shape with a companion lock, or whether the lock should be written separately and kept deliberately small.

The reproducible harness and contract source are in [`cellscript-escrow/`](./). I am keeping this local until the authorization path is tested end to end.
