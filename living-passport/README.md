# Living Passport

The new [public-testnet preview](PUBLIC_TESTNET.md) adds a browser-wallet connector, an on-chain history reader, and wallet-reviewed create/transfer flows. It is **not deployed to public testnet yet**; the contract address fields are intentionally empty. The signed local-devnet prototype below remains reproducible.

A local CKB experiment for a second-hand laptop. A passport Cell moves through creation, a workshop-signed repair, and a change of owner. The browser can now submit those transitions to an isolated CKB devnet, using **disposable development keys held by the local server**. It is not a public testnet deployment, a browser-wallet integration, or proof that a physical repair occurred.

Open the running prototype at [http://127.0.0.1:4185/](http://127.0.0.1:4185/). Without the devnet environment variables below, `npm run web` still serves the original in-memory draft mode on port 4184; the page labels its mode.

## What the contract binds

The Type Script requires one input passport and one successor on every update. Its 68-byte args hold a unique funding OutPoint and the configured workshop Lock hash. The successor Cell data contains a 102-byte header and a canonical event: action (1 byte), sequence (4), item ID (32), actor Lock hash (32), recipient Lock hash (32), UTF-8 detail length (1), and the readable detail (1–160 bytes). The contract recomputes the event hash from those exact bytes and chains it into the history root. It checks the action, sequence, item ID, current/next Lock hashes, workshop input, unchanged 600 CKB passport capacity, and the one-use mint funding OutPoint.

The readable detail and intended recipient are therefore part of what the contract verifies, not merely text next to an unrelated digest. The local node verifies standard secp256k1 signatures for the owner and workshop inputs. A name such as “Amina” or “Bench 01” remains an unverified label; the actual authorization is the Lock. Anyone using this beyond local development must consider privacy because the event text is public and permanent on a chain.

## Verify the contract

In WSL/Linux, with Rust's `riscv64imac-unknown-none-elf` target and Node.js 22:

```bash
cd living-passport/rust-contract
cargo build --locked --offline --release
cd ..
npm ci
npm test
```

The CKB-VM tests cover mint, repair and transfer, plus forged details, wrong actor/recipient, missing attester, wrong identity, skipped sequence, rewritten history and changed capacity. The ordinary draft tests remain separate.

## Reproduce signed local-devnet transactions

Start an isolated OffCKB devnet, deploy the built `living-passport-type` binary without Type ID, and set the two paths below to OffCKB's bundled **development-only** key file and generated `scripts.json`. The runner refuses non-local RPC and chains whose name does not contain `dev`. The standard secp256k1 CellDep is pinned to the OffCKB devnet used here; check it if the devnet version differs. Never use these keys on a public network.

```bash
PASSPORT_DEVNET_KEYS=/path/to/@offckb/cli/account/keys \
PASSPORT_DEVNET_DEPLOYMENT=/path/to/deployment/scripts.json \
node scripts/devnet-run.mjs
```

That script signs and waits for creation, repair, transfer, another repair by the new owner, and a return transfer. To connect the browser to the same local chain:

```bash
PORT=4185 \
PASSPORT_DEVNET_KEYS=/path/to/@offckb/cli/account/keys \
PASSPORT_DEVNET_DEPLOYMENT=/path/to/deployment/scripts.json \
PASSPORT_DEVNET_STATE=/tmp/living-passport-state.json \
npm run web
```

The state file is a local index of the submitted passport, **not** its authority. On restart, the service checks that its latest Cell data matches a committed transaction on the node. Do not reuse that file after resetting the devnet. Each browser action waits for confirmation and then shows the transaction hash. If submission times out, inspect the local node before trying again because the result may be uncertain.

## Boundaries

This prototype has three fixed development Lock identities: first owner, workshop, second owner. It alternates the two owner Locks on transfers; the typed name is a label and cannot specify an arbitrary wallet. The signing keys never enter the browser, but the local service is not a safe signer for real funds. There is no key-ownership challenge for a real buyer, workshop accreditation, physical device identity check, private-data policy, public-chain indexer, or close/reclaim transition. The 600 CKB is locked into the passport Cell across its updates; it is not a service fee.

The earlier workspace screenshots showed draft mode; they are not evidence of signed transactions. For the actual local-chain run, see [DEVNET.md](DEVNET.md).
