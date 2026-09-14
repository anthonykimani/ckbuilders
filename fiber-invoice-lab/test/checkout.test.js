import test from "node:test";
import assert from "node:assert/strict";
import { MemoryFiberProvider } from "../src/memory-provider.js";
import { CheckoutSession } from "../src/checkout.js";

test("creates and pays a checkout invoice", async () => {
  const checkout = new CheckoutSession(new MemoryFiberProvider());
  const session = await checkout.create({ amount: 1000n, description: "coffee", expiresIn: 60 });
  assert.equal(session.status, "open");
  assert.equal((await checkout.pay(session)).status, "succeeded");
});

test("rejects zero-value invoice", async () => await assert.rejects(() => new MemoryFiberProvider().createInvoice({ amount: 0n }), /positive/));
test("expired invoice cannot be paid", async () => {
  let now = 1000;
  const provider = new MemoryFiberProvider({ now: () => now });
  const checkout = new CheckoutSession(provider);
  const session = await checkout.create({ amount: 1n, expiresIn: 1 });
  now = 2000;
  await assert.rejects(() => checkout.pay(session), /expired/);
  assert.equal((await checkout.refresh(session)).status, "expired");
});

test("pay is idempotent for the same invoice", async () => {
  const provider = new MemoryFiberProvider();
  const invoice = await provider.createInvoice({ amount: 42n });
  const first = await provider.sendPayment({ invoice: invoice.invoice });
  const second = await provider.sendPayment({ invoice: invoice.invoice });
  assert.deepEqual(second, first);
});

test("tampered invoice is rejected", async () => {
  const provider = new MemoryFiberProvider();
  const invoice = await provider.createInvoice({ amount: 42n });
  await assert.rejects(() => provider.sendPayment({ invoice: invoice.invoice.replace(":42:", ":43:") }), /malformed/);
});
