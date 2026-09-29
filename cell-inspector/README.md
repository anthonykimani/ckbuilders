# CKB Cell Inspector

A small read-only viewer for CKB transactions. Paste a transaction hash and it loads the transaction and the previous transactions for each input. It then shows spent Cells, created Cells, capacity totals, and the fee when every previous Cell can be resolved.

```sh
npm test
npm start
```

Open `http://127.0.0.1:4177` and use the sample testnet transaction or paste your own hash. No wallet or signing is involved. The server calls the public CKB RPC nodes listed in [`inspector.js`](inspector.js). An internet connection is needed.

This is a local viewer, not a deployed dApp. It does not broadcast transactions. If a previous Cell is unavailable, it labels the input and does not guess the fee.
