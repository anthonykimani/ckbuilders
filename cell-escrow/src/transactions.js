import { encodeEscrowData, encodeWitness } from "./codec.js";
import { hashSecret } from "./protocol.js";

export function createEscrow({ payer, recipient, capacity, secret, refundSince, escrowLock }) {
  if (BigInt(capacity) <= 0n) throw new Error("capacity must be positive");
  return {
    kind: "create",
    outputs: [{ capacity: BigInt(capacity), lock: escrowLock, data: encodeEscrowData({ payer, recipient, paymentHash: hashSecret(secret), refundSince }) }],
    witnesses: [],
  };
}

export function claimEscrow(cell, recipient, preimage) {
  return { kind: "claim", inputs: [cell], outputs: [{ capacity: cell.capacity, lock: recipient, data: "0x" }], witnesses: [encodeWitness("claim", preimage)] };
}

export function refundEscrow(cell, payer) {
  return { kind: "refund", inputs: [cell], outputs: [{ capacity: cell.capacity, lock: payer, data: "0x" }], witnesses: [encodeWitness("refund")] };
}
