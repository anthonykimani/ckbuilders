import { createEscrow, claimEscrow } from "../src/transactions.js";
import { EscrowIndex } from "../src/indexer.js";

const payer = `0x${"11".repeat(32)}`, recipient = `0x${"22".repeat(32)}`;
const create = createEscrow({ payer, recipient, capacity: 30000000000n, secret: "demo-secret", refundSince: 500n, escrowLock: "cell-escrow-lock" });
const cell = { ...create.outputs[0], outPoint: "local-demo:0" };
const index = new EscrowIndex([cell]);
console.log("Created:", index.get(cell.outPoint));
console.log("Claim plan:", claimEscrow(cell, recipient, "demo-secret"));
index.consume(cell.outPoint);
console.log("Active escrows after settlement:", index.active().length);
