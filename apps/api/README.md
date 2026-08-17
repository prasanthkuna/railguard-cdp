# apps/api

Encore.ts backend for Railguard's verification-first payment control plane.

Detailed endpoint notes live in [docs/api/endpoints.md](../../docs/api/endpoints.md).

## Current endpoints

Legacy invoice path plus v5 financial authority API. Full list: [docs/api/endpoints.md](../../docs/api/endpoints.md).

### v5

- `POST /v1/intents`
- `POST /v1/intents/:id/authorize`
- `POST /v1/intents/:id/execute`
- `GET /v1/executions/:id`
- `GET /v1/executions/:id/evidence`

### Legacy (invoice → CDP)

- `GET /health`
- `GET /invoices`
- `GET /invoices/:id`
- `POST /vendors`
- `POST /vendors/:vendorID/wallets`
- `POST /invoices`
- `POST /policy/evaluate`
- `POST /approvals/:invoiceID`
- `POST /payment-intents`
- `POST /payment-intents/:id/execute`
- `GET /audit/:entityType/:entityID`

## Local auth model

Local development uses Encore's auth gateway with headers:

- `Authorization: Bearer <token>`
- `X-Organization-Id: <org id>`
- `X-Role: owner|finance|approver|viewer`
- `X-User-Id: <user id>` optional
- `X-User-Email: <email>` optional

## Service behavior

- deterministic invoice policy checks with explainable rule output
- tenant-scoped vendor, wallet, invoice, approval, and audit records
- idempotent payment-intent creation
- demo Base Sepolia USDC execution payload generation
- hash-chained audit log entries for every decision transition

## Verification

- `bun run verify:demo` seeds and validates the non-auth product flows against a local or deployed backend
