import { Transaction } from '@ckb-ccc/core';

// Anyone can create a cell under someone else's Lock without their signature. A cell only
// speaks for its Lock if that Lock also signed the transaction that wrote it, which means one
// of the transaction's inputs is locked by it.
export async function signedByHolder(client, cell) {
  const lockHash = cell.cellOutput.lock.hash();
  const result = await client.getTransaction(cell.outPoint.txHash);
  if (result?.status !== 'committed' || !result.transaction) return false;
  const tx = Transaction.from(result.transaction);
  for (const input of tx.inputs) {
    const previous = await client.getTransaction(input.previousOutput.txHash);
    const spent = previous?.transaction && Transaction.from(previous.transaction).outputs[Number(input.previousOutput.index)];
    if (spent?.lock.hash() === lockHash) return true;
  }
  return false;
}

export async function submit(signer, tx) {
  try {
    await tx.completeInputsByCapacity(signer);
  } catch {
    throw new Error('This wallet needs more testnet CKB for this. Fund it from the testnet faucet.');
  }
  await tx.completeFeeBy(signer);
  const hash = await signer.sendTransaction(tx);
  const confirmed = await signer.client.waitTransaction(hash, 0, 120000, 2000);
  if (!confirmed) throw new Error(`Submitted ${hash}, but confirmation timed out. Check the explorer before retrying.`);
  return hash;
}
