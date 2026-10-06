# Cell Relay acceptance checks

These are the cases the CellScript artifact and full CKB transaction harness must pass before anyone is invited to use the testnet app. A simulator-only pass is not sufficient. Record the compiler version, ELF hash, cycle count, transaction fixture, and result for each CKB-VM case.

## Valid

- Bootstrap exactly one baton tied to a unique origin, with turn 0 and an owner Lock.
- Current owner signs a handoff: turn 0 is consumed; turn 1 appears under the nominated recipient's Lock; origin is unchanged.
- Recipient signs the next handoff using the *confirmed* turn 1 outpoint. The turn 1 Cell is no longer live and turn 2 is live.
- An unrelated wallet input can pay fees and receive change without becoming part of the baton Type Script group.

## Must reject

- A witness claims the owner's address, but the owner's Lock signature is absent or invalid.
- A non-owner attempts to spend the baton.
- A transaction consumes two baton Cells with the same Type Script but checks only one.
- A transaction makes two baton successors from one input.
- A baton input is consumed with no successor.
- The new turn skips or repeats a number, changes the origin, or points to the wrong previous outpoint.
- The successor uses a different recipient Lock from the one authorized in the signed transaction.
- The successor has less than its occupied capacity, or any capacity rule claimed by the contract is violated.
- The same baton outpoint is spent twice; the second transaction is rejected by the node, not merely by the website.
- An output-only transaction creates an unauthorized baton with an existing origin.

## Evidence to publish

The repository should contain reproducible fixtures and tests, not only screenshots. The hosted page should link to its deployed testnet code Cell and example handoff transactions. Screenshots can illustrate the flow, but must not substitute for passing Lock + Type validation or node acceptance.

If a rule cannot be expressed in CellScript v0.31.0, mark that test unsupported and stop the testnet deployment. Do not silently move a security rule into the frontend.
