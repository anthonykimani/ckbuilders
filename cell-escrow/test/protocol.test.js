import test from "node:test";
import assert from "node:assert/strict";
import { encodeEscrowData, decodeEscrowData } from "../src/codec.js";
import { ERROR, hashSecret, validateSettlement } from "../src/protocol.js";
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
