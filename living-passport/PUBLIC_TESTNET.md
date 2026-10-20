# Public testnet

The public app connects a self-custody CKB testnet wallet through CCC, reads passport history from confirmed transactions, and supports four signed actions:

| Action | Who signs | Who pays |
| --- | --- | --- |
| Create | first owner | owner locks 600 CKB plus fee |
| Repair | workshop drafts and signs first, owner co-signs | workshop pays the fee |
| Transfer | current owner | fee comes from owner's wallet |
| Close | current owner | fee comes out of the returned 600 CKB |

**Status:** deployed to CKB public testnet on 2026-10-20 ([`public-web/deployment.testnet.json`](public-web/deployment.testnet.json)).

| | |
| --- | --- |
| Code hash (`data2`) | `0xb124f195e1d579f2d8d72325f9b7f232929cf9c7ee802effa071aaa589d1774e` |
| Deploy tx | [`0x0800743595486b5cd4f21d2fac3f26cb59bd0bfdc1ab1310017302185e672401`](https://testnet.explorer.nervos.org/transaction/0x0800743595486b5cd4f21d2fac3f26cb59bd0bfdc1ab1310017302185e672401) |

End-to-end run (`node scripts/testnet.mjs e2e`, script-held secp256k1 keys, 2026-10-20):

| Step | Transaction |
| --- | --- |
| Create | [`0x55a81a4b…f549c`](https://testnet.explorer.nervos.org/transaction/0x55a81a4beef9603923397744a705811e6b4dc1a9065d6abd6c6501ee23cf549c) |
| Repair with workshop signature only | rejected by the node (`TransactionFailedToVerify`, owner Lock) |
| Repair co-signed by owner | [`0x79653f17…991f`](https://testnet.explorer.nervos.org/transaction/0x79653f179d3fa8dc5dc9068aab2fd845bdc6ae6edffab5d11e733ae0ddfe991f) |
| Transfer to buyer | [`0xc1192572…3ac1`](https://testnet.explorer.nervos.org/transaction/0xc11925724897b0318d26266d639aea55f7537612d07b5e63db586bf6f8383ac1) |
| Buyer closes, 600 CKB returned | [`0x25c16e30…a110`](https://testnet.explorer.nervos.org/transaction/0x25c16e30efbdd6f98538d81ff0e239c20210a0ad99d86298ef1046e84d7fa110) |

A demo passport with one approved repair is left live: `0xfd6f3361e145fb94d452080f25c86783db3a1e2c82a4e38a28306d7d01d21a3c00000000d80c812bfc5b23643dc8d46c47e553eec8b8d4bdff94eb309a26dde4ca11d3d8`.

Not yet verified: co-signing with **JoyID** wallets in a browser. The run above uses private-key signers, so it proves the contract and transaction logic, not the JoyID popups.

## Two-signer repair

The contract requires a Cell locked by the passport's workshop among the inputs, and the passport itself is locked by the owner. A repair therefore needs two signatures on one transaction:

1. The workshop opens the passport, writes the repair note and taps **Sign draft**. `draftRepair` (in [`src/public-repair.js`](src/public-repair.js)) builds the successor Cell, adds one of the workshop's own Cells to pay the fee, adds the owner's Lock CellDeps and a witness placeholder, completes the fee, and signs only the workshop's input.
2. The signed draft is compressed into a link (`#repair=…`). The fragment never reaches a server.
3. The owner opens the link. `reviewRepair` checks the draft before anything is signed: exactly one passport input, still live, no other owner funds spent, the named workshop is an input, and the successor keeps the same owner, capacity, item ID and sequence + 1 with a correctly chained history root.
4. The owner signs only their input and submits. If either wallet changes the transaction hash while signing, the app refuses to submit.

Every Lock's CellDeps and witness placeholders are added before the first signature, because a signature covers the transaction hash and later changes would invalidate it. The owner placeholder is sized for JoyID (1,000 bytes), so the fee is slightly overestimated.

**Limitations.** Owners using a JoyID *sub-key* (a second device added to an account) are not supported for co-signing. The draft goes stale if the passport changes before the owner approves; the workshop then drafts again.

## Deploy and verify (maintainers)

```bash
cd living-passport/rust-contract && cargo build --locked --release && cd ..
npm ci && npm test
node scripts/testnet.mjs keys     # creates .deploy/testnet-keys.json, prints the deployer address and how much to fund
node scripts/testnet.mjs deploy   # publishes the binary, writes public-web/deployment.testnet.json
node scripts/testnet.mjs e2e      # create, workshop-only submit (must fail), co-signed repair, transfer, close
```

The keys in `.deploy/` are throwaway testnet keys (gitignored). The script refuses to run unless the RPC reports `ckb_testnet`.

## Run the site

```bash
npm run public:dev     # http://127.0.0.1:4186/
npm run public:build   # static output in public-web/dist-public/
```

The site is hosted on Vercel using [`vercel.json`](vercel.json): install with `npm ci`, build with `npm run public:build`, serve `public-web/dist-public`. In the Vercel project, set **Root Directory** to `living-passport`. Repair links keep the signed draft in the URL fragment, which browsers do not send to the host.

## Data and trust boundary

Event text is public and permanent. Do not enter serial numbers, personal contact details, or other private information. The script verifies signed Lock participation, recipient binding, event bytes and hash-linked history. It cannot establish that a laptop exists, that an owner label is accurate, or that a repair occurred. A workshop address chosen at creation is not accreditation. Closing a passport releases its capacity and ends the live record; the past events remain readable in historical transactions but the app only opens live passports.
