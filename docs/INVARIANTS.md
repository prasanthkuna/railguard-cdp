# Payment invariants (Railguard / coinbase)

Canonical financial invariants for CDP execution and reconciliation. Each maps to implementation and tests.

| ID | Invariant | Implementation | Tests |
|----|-----------|----------------|-------|
| **INV-001** | A broadcast transaction cannot release its reservation until settlement is definitively reverted. | `paymentState.ts` `shouldReleaseGuardOnExecutionFailure`, `api.ts` execution catch path | `payment-state.test.ts`, `payment-lifecycle.test.ts` (APF-003) |
| **INV-002** | Confirmation requires matching settlement facts (chain, token, sender, recipient, amount). | `packages/settlement/src/index.ts` `verifyTransferFacts` | `packages/settlement/src/index.test.ts`, `base-sepolia.integration.test.ts` (APF-004) |
| **INV-003** | One business payment intent produces at most one financially effective settlement. | `execution_idempotency_key` unique constraint, `isIdempotentExecutionReturn` | `execution-claim.test.ts`, migration `003` |
| **INV-004** | Process crash may delay convergence but cannot alter the eventual financial outcome. | Durable correlation fields (migration `008`), reconciler cron | `payment-lifecycle.test.ts` (correlation rebuild) |
| **INV-005** | Reconciliation is idempotent — repeated runs do not double-commit or double-release. | `transitionAfterSettlementVerification` with `alreadyCommitted` | `payment-lifecycle.test.ts` (late confirmation), `reconcile.test.ts` |
| **INV-006** | Material payment fact changes invalidate prior approvals. | Policy snapshot hash, `ensurePayable` / stale approval rejection | APF-005 in failure lab, `payment-lifecycle.test.ts` |
| **INV-007** | Unavailable policy or state infrastructure fails closed. | x402-guard `authorizePayment` reserve/commit, execution blocked without guard | `x402-guard` `authorize.test.ts` |
| **INV-008** | On-chain session limits survive middleware bypass. | railguard-new Authority Engine + hook (APF-006) | `forge test --match-contract PrdDemo` |

## State machine

See [STATE_MACHINE.md](./STATE_MACHINE.md).

## Adversarial profiles

| Profile | Invariant exercised |
|---------|---------------------|
| APF-003 | INV-001, INV-004 |
| APF-004 | INV-002 |
| APF-005 | INV-006 |

## Public evidence

[evidence index](https://github.com/prasanthkuna/railguard-new/tree/master/evidence)
