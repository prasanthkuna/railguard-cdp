# API Endpoints

Railguard exposes a small set of tenant-scoped Encore endpoints for workspace setup, invoice review, approvals, payment execution, and audit evidence.

## Conventions

- Base URL: `NEXT_PUBLIC_API_URL` in the frontend or `RAILGUARD_BASE_URL` for the verification script
- Authenticated requests send `Authorization`, `X-Organization-Id`, `X-Role`, and optional user headers
- Sensitive write paths are idempotent where it matters, especially payment intent creation and execution
- Async jobs are used for invoice extraction, audit exports, and notifications

## Workspace

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/workspace/bootstrap` | Create the first organization workspace and optional owner user |
| `GET` | `/workspace` | Read current workspace settings |
| `POST` | `/workspace/settings` | Update approval thresholds, token/chain policy, and wallet risk controls |
| `GET` | `/dashboard` | Aggregate blocked, ready, review, and protected-value metrics |
| `GET` | `/users` | List users already associated with the workspace |

## Vendors

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/vendors` | List workspace vendors |
| `POST` | `/vendors` | Create or upsert a vendor with status and risk score |
| `GET` | `/vendors/:id` | Read vendor detail, wallets, onboarding checklist, and audit history |
| `POST` | `/vendors/:vendorID/wallets` | Add or update a vendor wallet on an allowed chain |

Vendor detail responses include the manual onboarding checklist used in the operator UI so finance teams can review missing approvals or wallet coverage before enabling payments.

## Invoices And Policy

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/invoices/upload` | Upload a document for asynchronous extraction |
| `POST` | `/invoices` | Create a manual invoice record and immediately run policy evaluation |
| `GET` | `/invoices` | List invoices, optionally filtered by status |
| `GET` | `/invoices/:id` | Read invoice detail, policy run, approvals, uploads, payment intents, and audit trail |
| `POST` | `/policy/evaluate` | Re-run policy against the stored workspace settings |
| `POST` | `/policy/simulate` | Preview a policy outcome with temporary workspace overrides |

### Policy Inputs

The simulation and evaluation paths use the same workspace controls:

- `approvalThresholdBaseUnits`
- `hardCapBaseUnits`
- `allowedToken`
- `allowedChain`
- `amountReviewMultiplier`
- `walletRiskThreshold`

That keeps the operator-facing simulator aligned with the deterministic policy engine in `packages/policy`.

## Approvals And Payments

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/approvals/:invoiceID` | Approve or reject an escalated invoice |
| `POST` | `/payment-intents` | Build a CDP-compatible payment intent with an idempotency key |
| `POST` | `/payment-intents/:id/execute` | Execute a prepared payment intent with a separate execution idempotency key |

### Idempotency

- Creating the same payment intent twice with the same `idempotencyKey` returns the original record
- Executing the same payment intent twice with the same execution key returns the original execution result
- Reusing an execution key for a different payment intent fails fast

## Audit

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/audit/:entityType/:entityID` | Read append-only audit events for an entity |
| `POST` | `/audit/exports` | Queue a CSV or PDF export build |
| `GET` | `/audit/exports` | List requested exports |
| `GET` | `/audit/exports/:id` | Poll export status and fetch a signed download URL when ready |

Audit exports are produced asynchronously so the UI can request evidence bundles without blocking the main review flow.

## v5 Financial Authority

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/intents` | Create a `FinancialIntent` |
| `POST` | `/v1/intents/:id/authorize` | Policy + budget → `AuthorizationGrant` |
| `POST` | `/v1/intents/:id/execute` | Execute on selected rail (links to payment intent for CDP) |
| `GET` | `/v1/executions/:id` | Execution status |
| `GET` | `/v1/executions/:id/evidence` | Evidence envelope + explain payload |
| `GET` | `/v1/payment-intents/:id/evidence` | Evidence by legacy payment intent id |
| `GET` | `/v1/metrics/financial` | Financial SRE metrics |

See [INTEGRATION.md](../INTEGRATION.md) for CLI, MCP, and SDK.

## WorkOS Integration

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/workos/authorize` | Build a WorkOS authorization URL with PKCE |
| `POST` | `/auth/workos/exchange` | Exchange the WorkOS code for a session |
| `POST` | `/webhooks/workos` | Receive organization and membership lifecycle events |

Auth hardening is being handled as a separate rollout track; the endpoints above describe the current wiring only.
