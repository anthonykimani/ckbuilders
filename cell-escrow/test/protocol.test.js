import test from "node:test";
import assert from "node:assert/strict";
import { encodeEscrowData, decodeEscrowData } from "../src/codec.js";
import { ERROR, hashSecret, validateSettlement, validateSettlementTransaction } from "../src/protocol.js";
import { EscrowIndex } from "../src/indexer.js";

const payer = `0x${"11".repeat(32)}`;
const recipient = `0x${"22".repeat(32)}`;
const data = encodeEscrowData({ payer, recipient, paymentHash: hashSecret("open sesame"), refundSince: 500n });
const input = { outPoint: "0xabc:0", capacity: 30000000000n, lock: "escrow", data };

test("codec round-trips agreement fields", () => assert.deepEqual(decodeEscrowData(data), { version: 1, payer, recipient, paymentHash: hashSecret("open sesame"), refundSince: 500n }));
test("recipient claims with the correct preimage", () => assert.deepEqual(validateSettlement({ input, output: { capacity: input.capacity, lock: recipient }, witness: { action: "claim", preimage: "open sesame" }, signer: recipient, blockNumber: 1 }), { ok: true, action: "claim" }));
test("wrong preimage is rejected", () => assert.equal(validateSettlement({ input, output: { capacity: input.capacity, lock: recipient }, witness: { action: "claim", preimage: "wrong" }, signer: recipient, blockNumber: 1 }).code, ERROR.BAD_PREIMAGE));
test("payer cannot take the claim path", () => assert.equal(validateSettlement({ input, output: { capacity: input.capacity, lock: recipient }, witness: { action: "claim", preimage: "open sesame" }, signer: payer, blockNumber: 1 }).code, ERROR.WRONG_ACTOR));
test("refund before maturity is rejected", () => assert.equal(validateSettlement({ input, output: { capacity: input.capacity, lock: payer }, witness: { action: "refund" }, signer: payer, blockNumber: 499 }).code, ERROR.TOO_EARLY));
test("payer refunds after maturity", () => assert.equal(validateSettlement({ input, output: { capacity: input.capacity, lock: payer }, witness: { action: "refund" }, signer: payer, blockNumber: 500 }).ok, true));
test("settlement cannot redirect capacity", () => assert.equal(validateSettlement({ input, output: { capacity: input.capacity, lock: payer }, witness: { action: "claim", preimage: "open sesame" }, signer: recipient, blockNumber: 1 }).code, ERROR.BAD_OUTPUT));
test("consumed escrow cannot be settled twice", () => { const index = new EscrowIndex([input]); index.consume(input.outPoint); assert.throws(() => index.consume(input.outPoint), /already consumed/); });
test("transaction guard allows one escrow plus a fee input", () => {
  const result = validateSettlementTransaction({ inputs: [{ ...input, type: "escrow-type" }, { lock: "fee", capacity: 100000000n }], outputs: [{ capacity: input.capacity, lock: recipient }], witness: { action: "claim", preimage: "open sesame" }, signer: recipient, blockNumber: 1, escrowType: "escrow-type" });
  assert.equal(result.ok, true);
});
test("transaction guard rejects a second escrow input", () => {
  const result = validateSettlementTransaction({ inputs: [{ ...input, type: "escrow-type" }, { ...input, outPoint: "0xdef:0", lock: "different-lock", type: "escrow-type" }], outputs: [{ capacity: input.capacity, lock: recipient }, { capacity: input.capacity, lock: payer }], witness: { action: "claim", preimage: "open sesame" }, signer: recipient, blockNumber: 1, escrowType: "escrow-type" });
  assert.equal(result.code, ERROR.BAD_GROUP);
});
