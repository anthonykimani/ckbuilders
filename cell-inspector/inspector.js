export const RPC_URLS = Object.freeze({
  testnet: 'https://testnet.ckb.dev/',
  mainnet: 'https://mainnet.ckb.dev/',
});

export function isTransactionHash(value) {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function capacityOf(output) {
  return BigInt(output.capacity);
}

function cellSummary(output, data, index, outPoint = null) {
  return {
    index,
    outPoint,
    capacity: capacityOf(output).toString(),
    lockHash: output.lock.code_hash,
    lockHashType: output.lock.hash_type,
    typeHash: output.type?.code_hash ?? null,
    dataBytes: Math.max(0, (data?.length ?? 2) - 2) / 2,
  };
}

export async function inspectTransaction(callRpc, hash) {
  if (!isTransactionHash(hash)) throw new Error('Enter a 0x transaction hash with 64 hex characters.');
  const result = await callRpc('get_transaction', [hash]);
  if (!result?.transaction) throw new Error('Transaction not found on this network. Check the hash or switch networks.');
  const tx = result.transaction;
  const previousHashes = [...new Set(tx.inputs.map((entry) => entry.previous_output.tx_hash))];
  const previous = new Map(await Promise.all(previousHashes.map(async (previousHash) => {
    const found = await callRpc('get_transaction', [previousHash]);
    return [previousHash, found?.transaction ?? null];
  })));
  let inputTotal = 0n;
  let unresolved = 0;
  const inputs = tx.inputs.map((entry, index) => {
    const source = entry.previous_output;
    const prior = previous.get(source.tx_hash);
    const priorIndex = Number(BigInt(source.index));
    const output = prior?.outputs?.[priorIndex];
    if (!output) {
      unresolved += 1;
      return { index, outPoint: source, capacity: null, lockHash: null, typeHash: null, dataBytes: null, since: entry.since };
    }
    inputTotal += capacityOf(output);
    return { ...cellSummary(output, prior.outputs_data?.[priorIndex], index, source), since: entry.since };
  });
  const outputs = tx.outputs.map((output, index) => cellSummary(output, tx.outputs_data?.[index], index));
  const outputTotal = outputs.reduce((sum, output) => sum + BigInt(output.capacity), 0n);
  const fee = unresolved === 0 && inputTotal >= outputTotal ? inputTotal - outputTotal : null;
  return {
    hash: tx.hash ?? hash,
    status: result.tx_status?.status ?? 'unknown',
    blockHash: result.tx_status?.block_hash ?? null,
    inputs,
    outputs,
    inputTotal: unresolved === 0 ? inputTotal.toString() : null,
    outputTotal: outputTotal.toString(),
    fee: fee?.toString() ?? null,
    unresolved,
  };
}
