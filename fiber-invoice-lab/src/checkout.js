export class CheckoutSession {
  constructor(provider) { this.provider = provider; }
  async create({ amount, description, expiresIn }) {
    const invoice = await this.provider.createInvoice({ amount, description, expiresIn });
    return { id: invoice.paymentHash, encodedInvoice: invoice.invoice, amount: invoice.amount, description: invoice.description, expiresAt: invoice.expiresAt, status: invoice.status };
  }
  async pay(session) { const payment = await this.provider.sendPayment({ invoice: session.encodedInvoice }); return { ...session, status: payment.status, paidAt: payment.paidAt, fee: payment.fee }; }
  async refresh(session) { const invoice = await this.provider.getInvoice(session.id); return { ...session, status: invoice?.status ?? "unknown" }; }
}
