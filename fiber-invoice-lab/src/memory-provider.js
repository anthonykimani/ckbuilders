import { randomBytes } from "node:crypto";

const id = () => randomBytes(16).toString("hex");

export class MemoryFiberProvider {
  constructor({ now = () => Date.now() } = {}) { this.now = now; this.invoices = new Map(); this.payments = new Map(); }

  async createInvoice({ amount, currency = "Fibt", description = "", expiresIn = 300 }) {
    if (BigInt(amount) <= 0n) throw new Error("amount must be positive");
    const paymentHash = id();
    const invoice = { invoice: `fiber:${currency}:${amount}:${paymentHash}`, paymentHash, amount: BigInt(amount), currency, description, createdAt: this.now(), expiresAt: this.now() + expiresIn * 1000, status: "open" };
    this.invoices.set(paymentHash, invoice);
    return structuredClone(invoice);
  }

  async sendPayment({ invoice: encoded }) {
    const [, currency, amount, paymentHash] = encoded.split(":");
    const invoice = this.invoices.get(paymentHash);
    if (!invoice || invoice.currency !== currency || invoice.amount !== BigInt(amount)) throw new Error("unknown or malformed invoice");
    if (invoice.status === "paid") return structuredClone(this.payments.get(paymentHash));
    if (this.now() >= invoice.expiresAt) { invoice.status = "expired"; throw new Error("invoice expired"); }
    invoice.status = "paid";
    const payment = { paymentHash, amount: invoice.amount, status: "succeeded", paidAt: this.now(), fee: 0n };
    this.payments.set(paymentHash, payment);
    return structuredClone(payment);
  }

  async getInvoice(paymentHash) {
    const invoice = this.invoices.get(paymentHash);
    if (!invoice) return null;
    if (invoice.status === "open" && this.now() >= invoice.expiresAt) invoice.status = "expired";
    return structuredClone(invoice);
  }
}
