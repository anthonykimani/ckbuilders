# Cell Relay

Cell Relay is a public CKB testnet experiment in passing one live Cell between people. The site shows the current holder, the next handoff, and the exact input Cell consumed and output Cell created by each transaction. There is no prize pool or escrowed payment.

## Why build it

I want to learn what CellScript can actually enforce about a changing Cell, not just make a game that stores a turn number. A handoff crosses two boundaries: a Lock must authorize the current holder to spend the Cell, and a Type Script must restrict the successor Cell. My earlier escrow work showed why checking only the first grouped input or trusting a witness address is not enough.

## Rules to prove

Each relay has a unique origin and one live baton. A valid handoff:

1. Consumes exactly one baton Cell for that relay and creates exactly one baton Cell with the same Type Script identity.
2. Increments the turn by one, preserves the origin, and records the prior baton outpoint in the next state.
3. Changes the output Lock to the nominated recipient. The current holder must authorize the input through a real wallet Lock; a name in the witness is not authorization.
4. Preserves at least the occupied capacity of the successor Cell. Fees and additional capacity must be accounted for explicitly; the UI must not promise full capacity conservation without a checked rule.
5. Rejects extra grouped baton inputs or outputs, missing successors, skipped turns, changed origins, and redirected outputs.

The first release permits one handoff per transaction. A wallet may contribute separate funding and change Cells, but those must not be confused with the baton Type Script group. Replay is prevented by CKB's spent-input rule and by binding the successor to the consumed outpoint.

## What another person can try

Open the hosted testnet page, connect a supported wallet, inspect a relay, and accept a baton sent to their address. They can nominate the next address, preview the old and new Cells, sign, and see the confirmed transaction and history. The page must show testnet status and estimated capacity/fees before signing. A read-only view works without a wallet.

## Build stages

1. Pin CellScript v0.31.0. Implement the baton policy and negative tests in the simulator and CKB-VM. Record compiler version, artifact hashes, cycles, and any unsupported checks.
2. Run full transactions on a local CKB devnet, including the wallet Lock and the Type Script together. Test bootstrap, handoff, grouped-input/output attacks, capacity, and a stale-baton double-spend attempt.
3. Only after those checks pass, deploy a fresh testnet artifact and publish its code hash and deployment transaction. Build the wallet flow and a public read-only history view.
4. Invite a few CKBuilders to pass a baton. Capture failures and feedback; send Arthur a small reproducible CellScript case if the compiler cannot express or enforce a rule.

## Boundaries

This is a proposal, not a deployed app. CellScript v0.31.0's published release notes say its full release gate did not pass and make no new public-testnet deployment claim. Our own contract needs separate review. Do not ask users to fund an experimental Lock or treat a frontend check as an on-chain guarantee. If the Type Script cannot enforce the one-successor rule, stop before testnet interaction and publish the limitation instead.

Related work: CellScript's bundled token, NFT, vesting, timelock and AMM examples; CKB Battleship's proposed proof-bound private game transitions; and ckb-viz's general transaction viewer. Relay is narrower than Battleship and more interactive than a generic viewer: it tests a public, multi-user, single-Cell lifecycle with explicit Lock/Type responsibilities.
