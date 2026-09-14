# Fiber Invoice Lab

Fiber Invoice Lab is a small, provider-driven checkout core for CKB's Fiber Network. It makes invoice creation, payment, expiry, refresh and idempotency testable without hiding the boundary to a real Fiber node.

## Architecture

`CheckoutSession` contains application logic and depends on a provider with three operations: `createInvoice`, `sendPayment`, and `getInvoice`.

- `MemoryFiberProvider` is a deterministic local Fiber lifecycle simulator used by the tests and demo.
- `FiberSdkProvider` maps the same interface to an injected `@ckb-ccc/fiber` SDK instance.

This split is deliberate: payment UX can be developed and tested locally, while node connectivity, channels and liquidity remain explicit infrastructure concerns.

## Run

```bash
npm test
npm run demo
```

Requires Node.js 20+ and no dependencies for the simulator. A live integration additionally requires `@ckb-ccc/fiber` and a compatible Fiber node endpoint.

## Live-node checklist

1. Start a synced Fiber node and verify it with `getNodeInfo()`.
2. Ensure the node has CKB funding and usable channel liquidity.
3. Install `@ckb-ccc/fiber`, construct `FiberSDK`, and inject it into `FiberSdkProvider`.
4. Run an Fibt invoice/payment on testnet and record the payment hash, channel state and failure diagnostics.
5. Do not use the current canary SDK or protocol for production funds without reviewing current release guidance.

## Status

Five local tests cover the checkout lifecycle. No live Fiber payment is claimed yet because this workspace has no configured Fiber node, wallet key or funded channel.
