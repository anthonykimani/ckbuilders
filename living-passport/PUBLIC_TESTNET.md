# Public testnet preview

This is the next step after the signed local-devnet demonstration. The browser connects to a self-custody CKB testnet wallet through CCC, reads confirmed passport transactions from CKB, and prepares owner-signed creation and transfer transactions. It no longer relies on the local service or its disposable keys for those actions.

**Current status:** the public-testnet Rust contract has not been deployed. There is no public app URL, no public-testnet passport transaction, and no claim that the browser signing flow has been verified end to end. The local devnet test remains in [DEVNET.md](DEVNET.md). Workshop-signed repair is not enabled in this public preview because it needs two wallets to sign the same transaction; a single-wallet repair would misrepresent what the contract requires.

## Run the preview

Use Node 22 in WSL/Linux:

```bash
cd living-passport
npm ci
npm run public:dev
```

Open `http://127.0.0.1:4186/`. The page will say that public deployment is pending. Wallet connection can be explored, but create/transfer stay disabled. For a production build, run `npm run public:build`; the output is in `dist-public/`.

## Testnet wallet setup

Set up a **self-custody CKB testnet** wallet supported by CCC, such as JoyID, and switch it to testnet. Its address should start with `ckt`. The earlier Binance `ckb…` address is a mainnet exchange deposit address and cannot sign passport transactions. Never share a seed phrase or private key. Share only the public `ckt…` address if someone needs to send testnet CKB. The [CKB testnet faucet](https://faucet.nervos.org/) can fund it after setup.

The passport retains at least **600 testnet CKB** of capacity. That capacity stays inside the Cell when ownership changes. The contract currently has no close/reclaim transition, so even on testnet, do not treat this as a wallet for valuable funds.

## Deployment handoff

After a reviewed build of `rust-contract` is deployed as a public-testnet data Cell, put its actual code hash and deployment OutPoint in a `public-web/.env.local` file based on [`.env.example`](public-web/.env.example). The code hash must be the hash of the exact deployed binary, and the CellDep must point at that same binary. The app uses `data2` unless the deployment was made with another hash type. Never commit private keys to this file.

Only after that should we: run the CKB-VM tests again against the exact binary; fund a testnet wallet; create a passport with wallet approval; read back the confirmed history; transfer it between two distinct testnet wallets; compare the browser’s event details and Lock hashes with the explorer transaction; and finally host the built site. None of those public-chain steps have been claimed as complete here.

## Data and trust boundary

The on-chain event stores readable text permanently. Do not enter serial numbers, personal contact details, or other private information. The script verifies signed Lock participation, recipient binding, event bytes and hash-linked history. It cannot establish that a laptop exists, that an owner label is legally accurate, or that a repair occurred. A workshop address configured at creation is not accreditation.
