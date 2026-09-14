const HEX_32 = /^0x[0-9a-f]{64}$/i;

export function assertHex32(value, name) {
  if (!HEX_32.test(value)) throw new Error(`${name} must be a 32-byte 0x-prefixed hex value`);
  return value.toLowerCase();
}

export function encodeEscrowData({ version = 1, payer, recipient, paymentHash, refundSince }) {
  assertHex32(payer, "payer");
  assertHex32(recipient, "recipient");
  assertHex32(paymentHash, "paymentHash");
  const since = BigInt(refundSince);
  if (since < 0n || since > 0xffffffffffffffffn) throw new Error("refundSince must fit in u64");
  const bytes = new Uint8Array(105);
  bytes[0] = version;
  for (const [offset, value] of [[1, payer], [33, recipient], [65, paymentHash]]) {
    bytes.set(Buffer.from(value.slice(2), "hex"), offset);
  }
  new DataView(bytes.buffer).setBigUint64(97, since, true);
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

export function decodeEscrowData(hex) {
  if (!/^0x[0-9a-f]+$/i.test(hex) || hex.length !== 212) throw new Error("invalid escrow data");
  const bytes = Buffer.from(hex.slice(2), "hex");
  return {
    version: bytes[0],
    payer: `0x${bytes.subarray(1, 33).toString("hex")}`,
    recipient: `0x${bytes.subarray(33, 65).toString("hex")}`,
    paymentHash: `0x${bytes.subarray(65, 97).toString("hex")}`,
    refundSince: new DataView(bytes.buffer, bytes.byteOffset + 97, 8).getBigUint64(0, true),
  };
}

export function encodeWitness(action, preimage = "") {
  if (action === "claim") return { action, preimage };
  if (action === "refund") return { action };
  throw new Error("action must be claim or refund");
}
