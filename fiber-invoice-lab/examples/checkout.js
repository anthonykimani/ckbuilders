import { MemoryFiberProvider } from "../src/memory-provider.js";
import { CheckoutSession } from "../src/checkout.js";

const checkout = new CheckoutSession(new MemoryFiberProvider());
const invoice = await checkout.create({ amount: 2500n, description: "CKB Builders demo", expiresIn: 300 });
console.log("Invoice created:", invoice);
console.log("Payment result:", await checkout.pay(invoice));
