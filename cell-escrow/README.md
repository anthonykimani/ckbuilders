# CellEscrow

CellEscrow is a CKB-native conditional payment protocol prototype. Each agreement is represented by one live cell; consuming that cell is the settlement state transition.

## Settlement rules

- **Claim:** the recipient signs and reveals a preimage matching the agreement's payment hash.
- **Refund:** the payer signs after the absolute block-number timelock matures.
- The settlement output must preserve the locked capacity (fees are expected to come from a separate fee input) and pay the correct party.
- A consumed outpoint disappears from the live-cell index, making double settlement impossible.

## Cell data layout

| Offset | Bytes | Field |
| ---: | ---: | --- |
| 0 | 1 | schema version |
| 1 | 32 | payer lock identity |
| 33 | 32 | recipient lock identity |
| 65 | 32 | SHA-256 payment hash |
| 97 | 8 | refund block number, little-endian u64 |

The prototype separates deterministic protocol logic from chain adapters. `src/protocol.js` is the executable validation model; `src/transactions.js` produces create/claim/refund plans; and `src/indexer.js` models live-cell discovery. The next deployment step is to port the same validation boundary to ckb-js-vm and replace the in-memory index with the CKB indexer RPC.

## Run

Requires Node.js 20+ and no third-party dependencies.

```bash
npm test
npm run demo
```

## Status

The protocol model and eight adversarial lifecycle tests run locally. No devnet deployment or on-chain transaction is claimed in this repository yet; see `DEPLOYMENT.md` for the exact remaining steps.
