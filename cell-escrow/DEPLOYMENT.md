# Deployment checklist

1. Implement the validator entry point with ckb-js-vm syscalls, preserving the tested error-code mapping.
2. Compile the bundle to bytecode and deploy its code cell with OffCKB.
3. Record the code hash, hash type, outpoint and network in `deployment/scripts.json`.
4. Build CCC adapters for create, claim and refund plans; fund fees with a normal signer-owned input.
5. Query live escrow cells by the deployed lock script through the CKB indexer.
6. Run the eight acceptance cases against devnet and record transaction hashes plus rejection logs.
