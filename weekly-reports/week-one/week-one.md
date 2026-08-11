# CKB Builder Track - Week 1

Week Ending: 2026-08-11

## Courses & Reading Completed

- **Introduction to Nervos CKB**: core technical concepts and terminology
- **Getting Started on CKB**: set up a local dev environment using the OffCKB CKB node running locally on port 28114
- **CKB Academy - Lessons 1 & 2**: cell structure and transaction structure, written up in `ckb-basic-theoretical-knowledge/`
- **Introduction to Script**: overview of smart contracts on CKB, lock vs type scripts, and where script code actually lives
- **RFC 0025 - Simple UDT**: the standard for fungible tokens on CKB

## Practical Exercises

| Exercise | Status | Link |
| -------- | ------ | ---- |
| Transfer CKB | Done | `simple-transfer/` |
| Store Data on Cell | Done | `store-data-on-cell/` |
| Issue & Transfer Custom Token | Done | `xudt/` |

### Simple Transfer: `simple-transfer/`

A minimal dApp that connects a CKB wallet, displays the balance, and sends a CKB transfer on-chain.

What I learned:

- How the CKB cell model works in practice
- Using CCC (Common Chain Connector) to interact with wallets and broadcast transactions
- The difference between lock scripts and type scripts at a basic level
- Building a transaction with `completeInputsByCapacity` and `completeFeeBy` so CCC fills in what's missing

Reference: [Official tutorial](https://docs.nervos.org/docs/dapp/transfer-ckb)

### Store Data on Cell: `store-data-on-cell/`

A dApp that writes and reads arbitrary data to/from a cell on the CKB blockchain.

What I learned:

- How to store data in the `data` field of a CKB cell
- Encoding strings as hex before writing and decoding them back after reading
- Reading cell data back from the chain by outpoint (`txHash` + index)
- The lifecycle of a cell: creation, update, and consumption

Reference: [Official tutorial](https://docs.nervos.org/docs/dapp/store-data-on-cell)

### Issue & Transfer Custom Token: `xudt/`

A dApp that issues a custom fungible token, queries the cells that hold it, and transfers it between addresses.

What I learned:

- How the xUDT type script enforces token rules on top of a regular cell
- The xUDT args act like a unique id for your token, similar to an ERC20 contract address
- Token amounts are encoded in the cell data as little-endian bytes
- `completeInputsByUdt` collects the right cells when building a token transfer
- A change output is needed when you don't spend the full balance of a token cell

Reference: [Official tutorial](https://docs.nervos.org/docs/dapp/create-token)

## Key Learnings

- A cell carries capacity, data, a lock script, and optionally a type script
- Capacity locks up CKB proportional to the cell's byte size. Unlike Ethereum gas fees, it's not spent. You get it back when the cell is consumed
- Lock scripts control ownership via `code_hash`, `hash_type`, and `args`, typically a hash of the user's public key
- Type scripts are optional and enforce custom validation logic, like token rules
- Script code is not stored in every cell. `code_hash` points to a dependency cell holding the bytecode, keeping the chain efficient
- A transaction consumes existing cells as inputs and creates new ones as outputs. Cells cannot be edited in place
- Cells are identified by outpoints (`tx_hash` + `index`), which is how inputs reference the cells they consume
- A live cell is one that has been created but not yet consumed. Reading a cell requires its outpoint and checking it is still live
- Cell data is a single raw byte sequence. Multiple values can be encoded into it, but the protocol sees one blob
