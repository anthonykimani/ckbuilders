import { createHash } from "node:crypto";
import { decodeEscrowData } from "./codec.js";

export const ERROR = Object.freeze({ INVALID_ACTION: 10, BAD_PREIMAGE: 11, WRONG_ACTOR: 12, TOO_EARLY: 13, BAD_OUTPUT: 14, BAD_GROUP: 15 });

export function hashSecret(secret) {
  return `0x${createHash("sha256").update(secret).digest("hex")}`;
}

function reject(code, message) {
  return { ok: false, code, message };
}

export function validateSettlement({ input, output, witness, signer, blockNumber }) {
  const agreement = decodeEscrowData(input.data);
  if (!witness || !["claim", "refund"].includes(witness.action)) return reject(ERROR.INVALID_ACTION, "unknown settlement action");
  if (output.capacity !== input.capacity) return reject(ERROR.BAD_OUTPUT, "settlement must preserve escrow capacity before fees");

  if (witness.action === "claim") {
    if (signer !== agreement.recipient) return reject(ERROR.WRONG_ACTOR, "only the recipient can claim");
    if (hashSecret(witness.preimage ?? "") !== agreement.paymentHash) return reject(ERROR.BAD_PREIMAGE, "preimage does not satisfy payment hash");
    if (output.lock !== agreement.recipient) return reject(ERROR.BAD_OUTPUT, "claim output must pay recipient");
    return { ok: true, action: "claim" };
  }

  if (signer !== agreement.payer) return reject(ERROR.WRONG_ACTOR, "only the payer can refund");
  if (BigInt(blockNumber) < agreement.refundSince) return reject(ERROR.TOO_EARLY, "refund timelock has not matured");
  if (output.lock !== agreement.payer) return reject(ERROR.BAD_OUTPUT, "refund output must pay payer");
  return { ok: true, action: "refund" };
}

// A transaction-level check is needed before applying the one-Cell rules.
// Fee inputs may be present, but every input carrying the escrow lock must be
// accounted for. This models a builder guard; it is not an on-chain lock script.
export function validateSettlementTransaction({ inputs, outputs, witness, signer, blockNumber, escrowType }) {
  if (!Array.isArray(inputs) || !Array.isArray(outputs) || typeof escrowType !== "string") {
    return reject(ERROR.BAD_GROUP, "missing transaction inputs, outputs, or escrow type");
  }
  const escrowInputs = inputs.filter((cell) => cell.type === escrowType);
  if (escrowInputs.length !== 1) {
    return reject(ERROR.BAD_GROUP, "settlement must consume exactly one escrow cell");
  }
  if (outputs.length === 0) return reject(ERROR.BAD_OUTPUT, "missing settlement output");
  return validateSettlement({ input: escrowInputs[0], output: outputs[0], witness, signer, blockNumber });
}
