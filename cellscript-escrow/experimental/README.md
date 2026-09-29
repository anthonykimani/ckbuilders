# Experimental escrow settlement — do not deploy

`settle.cell` is a local CKB-VM experiment, not a safe contract. The two-escrow-input fixture in `test/settle-transaction.test.js` is accepted even though the second escrow Cell's capacity is redirected. The script currently validates only the first group input. The first typed escrow Cell also cannot be created with this artifact. An off-chain transaction-builder check cannot enforce the rule for arbitrary transactions.

Do not use this code with real CKB until the group-input and creation rules are enforced on-chain and re-tested.
