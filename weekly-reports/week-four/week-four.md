# CKB Builder Track — Week 4

Week Ending: 2026-08-31

## Theme: From L1 Settlement to Fiber Payments

After building an escrow state transition on CKB, I explored the opposite side of the application spectrum: a fast invoice checkout over Fiber Network. Fiber moves repeated payments off-chain while retaining CKB as the channel funding and settlement layer.

## Project Delivered: Fiber Invoice Lab

| Deliverable | Status | Location |
| --- | --- | --- |
| Checkout application interface | Complete | `fiber-invoice-lab/src/checkout.js` |
| Deterministic Fiber lifecycle simulator | Complete | `fiber-invoice-lab/src/memory-provider.js` |
| `@ckb-ccc/fiber` adapter boundary | Complete | `fiber-invoice-lab/src/fiber-sdk-provider.js` |
| Lifecycle and failure tests | 5 passing | `fiber-invoice-lab/test/` |
| Executable checkout demo | Complete | `fiber-invoice-lab/examples/checkout.js` |
| Live testnet payment | Not yet executed | Requires a funded Fiber node/channel |

## Why a Provider Boundary Matters

The checkout flow needs only three capabilities: create an invoice, pay it and query its state. It should not need to understand peer connections, channel creation or RPC naming.

```text
CheckoutSession
      |
      +-- MemoryFiberProvider  -> deterministic development and tests
      |
      +-- FiberSdkProvider     -> @ckb-ccc/fiber -> Fiber node
```

This architecture does not pretend that a simulator is the network. Instead, it makes the application's assumptions executable while isolating the exact boundary that needs live infrastructure.

## Lifecycle Implemented

An invoice starts open, can become paid once, and becomes expired when its deadline passes. Payment is idempotent: repeating the same request returns the original successful result rather than creating a second charge. A changed amount invalidates the encoded invoice and is rejected.

The five tests cover successful checkout, zero-value rejection, expiry, idempotent replay and invoice tampering.

## CKB L1 vs Fiber

CellEscrow and Fiber solve different problems:

| Concern | CKB L1 escrow | Fiber invoice |
| --- | --- | --- |
| State | live cells | channel/node state |
| Confirmation | on-chain inclusion | payment protocol result |
| Best fit | durable conditional settlement | frequent, low-latency payments |
| Discovery | indexer query | Fiber node RPC |
| Failure focus | script validation | routing, liquidity, expiry, peers |

The practical insight is not “Fiber replaces CKB.” Fiber depends on CKB for funding and settlement while optimizing the payment interaction above it.

## Current Ecosystem Notes

The official JavaScript SDK exposes channel, invoice, payment, information and peer operations through `@ckb-ccc/fiber`. Its current documentation also warns that Fiber remains under active development. For that reason, the project keeps the adapter small, pins no unverified canary version, and labels the live-node step honestly.

References:

- [Fiber JavaScript SDK](https://www.fiber.world/docs/build/sdk/js)
- [Open a Fiber channel and send a payment](https://www.fiber.world/docs/build/open-channel-payment)
- [Fiber node repository](https://github.com/nervosnetwork/fiber)

## What I Learned

Payment application code is only one layer of the system. A successful live payment also depends on a synced node, peer connectivity, channel state and sufficient outbound/inbound liquidity. Those operational requirements should be observable rather than hidden behind a “Pay” button.

## Next Step

Week 5 will harden both projects: run all suites from a clean checkout, document trust boundaries and deployment gaps, and define an honest path from prototypes to public testnet evidence.
