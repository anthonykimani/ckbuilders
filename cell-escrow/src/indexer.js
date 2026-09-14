import { decodeEscrowData } from "./codec.js";

export class EscrowIndex {
  constructor(cells = []) { this.cells = new Map(cells.map((cell) => [cell.outPoint, cell])); }
  consume(outPoint) { if (!this.cells.delete(outPoint)) throw new Error("escrow is already consumed or unknown"); }
  active() { return [...this.cells.values()]; }
  byPayer(payer) { return this.active().filter((c) => decodeEscrowData(c.data).payer === payer); }
  byRecipient(recipient) { return this.active().filter((c) => decodeEscrowData(c.data).recipient === recipient); }
  get(outPoint) { return this.cells.get(outPoint); }
}
