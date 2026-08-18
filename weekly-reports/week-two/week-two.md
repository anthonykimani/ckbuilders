# CKB Builder Track - Week 2

Week Ending: 2026-08-17

## Dev Environment

- **OffCKB devnet node**: CKB RPC at `http://127.0.0.1:8114`, RPC proxy at `http://127.0.0.1:28114`
- Default devnet account #0: `ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8`
- `ckb-debugger` not installed, so the build uses the `offckb debugger` fallback

## Courses & Reading Completed

- **Spore Protocol**: the standard for digital objects (DOBs) on CKB, the CKB version of NFTs
- **Create a DOB tutorial**: using the Spore protocol to turn user content into an immutable on-chain digital object
- **Build a Simple Lock tutorial**: writing a custom lock script and deploying it to the chain
- **ckb-js-vm**: the JavaScript runtime that lets smart contracts run as JavaScript on the CKB VM

## Practical Exercises

| Exercise | Status | Link |
| -------- | ------ | ---- |
| Create a DOB | Done | `create-dob/` |
| Build a Simple Lock | Done | `simple-lock/` |

### Create a DOB: `create-dob/`

A dApp that mints a Spore DOB from an uploaded image and reads it back from the chain.

What I learned:

- A DOB is just a cell with a Spore type script, the same cell model I already knew
- The image lives in the cell data, prefixed by its `contentType`, like `image/jpeg`
- The Spore type script makes content immutable once minted
- `@spore-sdk/core` + CCC handle the transaction building, from collecting input cells to signing
- The `spore-config.ts` holds all the script info, which I generated from the devnet with `offckb system-scripts`
- Verified it end to end: minted a DOB from a tiny JPEG (Spore ID `0xc579...`) and read the content back byte-for-byte from the chain

Details:

- Mint tx: `0x2aee0f25524995a9f176f306a60e4b74174ac7633e272292001678423e781467`
- Spore ID: `0xc5793a4fdeb0243867573714fd26f0169a7349db0e78877854c43ea85c6678aa`
- Output index: `0`
- Content type: `image/jpeg`, content read back matches the uploaded bytes exactly
- Stack: Parcel + React, `@spore-sdk/core` 0.2.0-beta.3, `@ckb-ccc/core`, `@ckb-lumos/lumos`
- Spore script on devnet: codeHash `0x7e8bf78a62232caa2f5d47e691e8db1a90d05e93dc6828ad3cb935c01ec6d208`, hashType `data2`, cell dep `0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7` index `0xa`

Reference: [Official tutorial](https://docs.nervos.org/docs/dapp/create-dob)

### Build a Simple Lock: `simple-lock/`

A dApp with a custom `hash_lock` contract written in JavaScript that only unlocks a cell when the witness contains the right preimage.

What I learned:

- Lock scripts gate who can spend a cell, and this one is entirely custom
- A JS contract gets bundled to bytecode with esbuild and compiled to `.bc` with `ckb-debugger`, then runs inside the **ckb-js-vm** on CKB
- The lock script is a nested script: the outer `ckb_js_vm` script, with its args carrying the contract code hash, the hash type, and the hashed preimage
- The preimage is passed at runtime through the witness args
- Deployed the contract with `offckb deploy`, which puts the bytecode in a code cell and points `cellDeps` at it
- The deployment record in `deployment/scripts.json` is per-network, so I regenerated it and synced it to the frontend
- Verified it end to end: deposited CKB to the hash-lock address, unlocked with the correct preimage `Hello World`, and got the wrong preimage rejected with error code 11

Details:

- Contract codeHash: `0xcd262cb39d9e83f63e5415a56a23982fb6ae79b993e3cf371c12fad71dd23519`, hashType `data2`
- Deploy tx: `0x767db0cea95d8e2090afd35f002f10544149137d35f523573b1f1ebc7ff5b0bd`
- Preimage: `Hello World`, blake2b hash: `0x106911e4f83e790e1eb2f39bdff23c1db43ed5af9219f763e571389af21259ca`
- Hash-lock address: `ckt1qzkymvxscq5t5rtnmmy7uhn28sxf3lxle2y4gq4r9pwksr5kfh95vqgqqrxjvt9nnk0g8a372s26263rnqhmdtnehxf78nehrsf044ca6g63jpqsdyg7f7p70y8pavhnn00ly0qaksldttujr8mk8et38zd0yyjeegwmczc8`
- Deposit tx (300 CKB): `0xa497e3c60c953d4b6e2ec0e92086e73f52f6007f5f8286762bee87674f72ffdb`
- Unlock tx (99 CKB, correct preimage): `0x33028dc77e18085abf5a9e4914a77f8a6ef4a1212f2897a16780d0493b32b441`
- Wrong preimage: rejected by the contract with `error code 11`
- Frontend: Next.js 15 on `http://localhost:3000`, reads `frontend/deployment/scripts.json`
- Build: esbuild bundle + `ckb-debugger` to `dist/hash-lock.bc`, tests in `tests/` (mock + devnet both pass)

Reference: [Official tutorial](https://docs.nervos.org/docs/dapp/simple-lock)

## Key Learnings

- A DOB is a normal cell with a Spore type script; content and content type live in the cell data
- Spore content can't be changed after minting, enforced by the type script
- Smart contracts on CKB don't have to be Rust or C. JavaScript runs through the ckb-js-vm
- A custom lock script embeds the contract's code hash in its args, so the VM knows which program to run
- Runtime inputs to a script, like the preimage, travel in the witness
- Deploying a script means publishing bytecode into a code cell, then referencing it with `cellDeps`
- `offckb deploy` output is per-network. The frontend reads its own copy of `scripts.json`, so it needs the fresh one
- `ckb-debugger` isn't installed by default, but the `offckb debugger` fallback compiles JS contracts fine