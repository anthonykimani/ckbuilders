# CKB Builder Track — Week 5

Week Ending: 2026-09-07

## Theme: Verification, Failure Modes and Production Readiness

This week I treated documentation and negative tests as part of the protocol—not as cleanup after coding. I reviewed CellEscrow and Fiber Invoice Lab together, made their trust boundaries explicit, and converted deployment assumptions into checklists.

## Work Completed

- Two dependency-free project cores that run on Node.js 20+.
- Thirteen total tests covering both successful paths and adversarial/failure cases.
- A versioned binary schema for escrow cells.
- Output-preservation and destination checks for settlement.
- A live-cell index model with double-consumption rejection.
- A provider boundary separating Fiber checkout logic from node RPC.
- Invoice expiry, tamper detection and idempotent replay behavior.
- README files, executable demos and explicit live-deployment checklists.

## Threat and Failure Review

| Risk | Control in the prototype | Remaining production work |
| --- | --- | --- |
| Wrong party claims escrow | signer identity check | bind identity to actual CKB lock/script group |
| Secret is incorrect | payment-hash comparison | select and document final hash syscall |
| Claim redirects funds | required recipient output lock | validate real output indices/capacity in VM |
| Premature refund | absolute block-height threshold | encode and validate CKB `since` semantics |
| Double settlement | consumed outpoint leaves live set | verify with devnet transaction rejection |
| Invoice amount tampered | encoded amount/hash validation | rely on canonical Fiber invoice decoder |
| Invoice replay | idempotent payment result | persist payment state across restarts |
| Invoice expires | explicit deadline check | reconcile local clock with node response |
| Payment has no route | outside simulator boundary | expose route/liquidity diagnostics from node |

## What “Done” Means

There are two different completion levels and the repository now states them clearly.

**Prototype complete** means the data model, state transitions, adapter boundary and test expectations are executable and reproducible locally. Both projects are at this level.

**Network verified** means deployed code, funded wallets/channels, successful transactions/payments and captured failure evidence on a named network. Neither new project claims this level yet because no signer credentials, running devnet/Fiber node or funded channel were available in this workspace.

This distinction matters. Week 2 had real transaction hashes, so lowering the evidence standard for later reports would make the progression look stronger while actually being less trustworthy.

## Reproducibility

From the repository root:

```bash
cd cell-escrow && npm test && npm run demo
cd ../fiber-invoice-lab && npm test && npm run demo
```

Expected result: eight passing CellEscrow tests and five passing Fiber Invoice Lab tests, followed by a printed local lifecycle for each project.

## Architecture Takeaway

The projects form one useful mental model:

```text
Customer interaction
        |
        v
Fiber invoice/payment  -- fast repeated exchange
        |
        v
CKB channel settlement -- durable ownership transition

CKB CellEscrow         -- custom conditional L1 settlement
```

Application builders should choose the narrowest layer that enforces the requirement. Use Fiber for payment velocity and user experience; use CKB scripts when the chain itself must verify the condition.

## Next Milestone

The highest-value next work is network verification, not more features:

1. Port CellEscrow's tested validation model to ckb-js-vm syscalls.
2. Deploy it to OffCKB devnet and execute the eight acceptance cases.
3. Start two Fiber nodes or connect to a testnet peer, fund a channel and run the checkout adapter.
4. Add the resulting transaction/payment identifiers and raw rejection evidence to these reports.
5. Only then add wallet UI, xUDT escrow or Spore receipts.

## Final Reflection

Weeks 1–2 taught me the primitives. Weeks 3–5 taught me to define state, authorization, failure and evidence as one design problem. The most CKB-native lesson is that ownership transitions are the application: cells carry the committed state, scripts verify allowed consumption, and the live-cell set tells the application what still exists.
