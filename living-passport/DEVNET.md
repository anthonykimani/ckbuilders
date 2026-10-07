# Signed local devnet evidence

On 7 October 2026 I deployed the updated Rust Type Script to an isolated OffCKB `ckb_dev` chain. Its immutable deployment transaction was `0xa88344991d2f5b51056d9d8197188dfd7a6f14be70056ff62238514d7b824798`; its code hash was `0xd80cbb87bbf7b486041f24a12bf24297db84b5341f41bd619520e9bc165200bc`. These identifiers only exist on this local chain, not on public testnet or mainnet.

The signed five-step runner submitted these transactions and waited for each to commit before spending the successor Cell:

| Action | Committed local transaction |
| --- | --- |
| Create | `0x6dd6a7ab91341a5f3ea77ce70eacd892d6560dcee6c47bcd163cd8556757bdc6` |
| Workshop repair | `0xb8860c99f8a9a35f456b9c6010a2b997c54bbcfd19a7c477fbf2eb8cc4f19a4b` |
| Transfer to second devnet Lock | `0x15c697829539dba815cd6b88464505da70f16c9467bd04c87c58ce780f037b0a` |
| Repair signed by second owner and workshop | `0x7d85af89d074cc12a87efd7297f2d16d40d3b56fe4ab5f4adabbfda5e4105c2c` |
| Return transfer signed by second owner | `0xe5903a3b13c84bc81cf2ef823798ed99aa8755b9c35f38f50943fdedd3473bb2` |

The browser service also submitted create, repair, and transfer requests to the same local node. The node's `get_transaction` returned `committed` for each of these browser-service hashes: `0xa2096673abd137f95781b09b9082e756e7c5f7fc006f7f8967f141232b5849c6`, `0x6d26a4a50bf1a0d631983c97bd16928879412e25acfdc0c8de57231744064c6e`, and `0x9271a71b1cc4ba4c071e7b970fb2c29607aa873d65c896bce96708883b5ffbd3`. They are development-chain evidence only. The service signs on the server with OffCKB fixture keys; a browser wallet does not sign.

After adding a local state index, I ran the browser service again: create `0xdae2fd8522e1f6ac00c0e98cab14027a6a7dcbb92116894f74bfea07012187be`, repair `0x10f959792c8c512bc735654eb871e9b5898e6660964504e67c49db68d1e263a6`, and transfer `0x2baae61c06d5d2d0966e50f5e5c9cbe9ecc6bda0eac41d06cb991a17be391939`. I stopped and restarted the service. Its API restored sequence 2, all three events, and the same latest hash after comparing the saved latest Cell data with the node's committed transaction. From that restored state, the second owner and workshop signed another repair `0xaa833d59cc44a8135b732949415e5e54d7bfed49abaf649e1318ca1707c71079`, followed by a return transfer `0xc0da7c2a9308228e37fc1a5935630f68827bf6be910be9cc0905cde463883d16`. A false workshop label was rejected without changing the five-event record.

The Rust contract was also compiled for CKB-VM and the full test suite passed: four test groups with positive mint/repair/transfer and negative tampering scenarios. The CKB-VM cycle counts for those positives were 41,407, 54,955, and 52,380 respectively. Mock tests use `alwaysSuccess` Lock for shape checks; the devnet transactions above use actual secp256k1 Lock signatures.
