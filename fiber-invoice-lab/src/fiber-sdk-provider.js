// Adapter boundary for @ckb-ccc/fiber. Keeping the import outside this package lets
// the deterministic test suite run without a node or network access.
export class FiberSdkProvider {
  constructor(sdk) { this.sdk = sdk; }
  async createInvoice({ amount, currency = "Fibt", description, expiresIn }) {
    const result = await this.sdk.newInvoice({ amount: `0x${BigInt(amount).toString(16)}`, currency, description, expiry: `0x${BigInt(expiresIn).toString(16)}` });
    return { invoice: result.invoiceAddress ?? result.invoice, paymentHash: result.paymentHash, amount: BigInt(amount), currency, description, expiresAt: Date.now() + expiresIn * 1000, status: "open" };
  }
  async sendPayment({ invoice }) { const result = await this.sdk.sendPayment({ invoice }); return { paymentHash: result.paymentHash, status: "succeeded", paidAt: Date.now(), fee: BigInt(result.fee ?? 0) }; }
  async getInvoice(paymentHash) { return this.sdk.getInvoice({ paymentHash }); }
}
