# Architecture Overview

Railguard is split into a user-facing operator application and a service-oriented backend.

## Top-Level Components

- `apps/web`: invoice inbox, vendor registry, approvals, payment intent review, audit trail
- `apps/api`: Encore.ts services for ingestion, policy evaluation, approvals, payments, and audit
- `packages/policy`: deterministic rule engine and evidence generation
- `packages/audit`: append-only audit events, hash chaining, export builders
- `packages/auth`: WorkOS identity integration and app role mapping
- `packages/cdp`: Coinbase CDP payment preparation and execution helpers
- `packages/db`: schema ownership, migrations, query boundaries, and tenancy helpers

## Design Constraints

- AI can extract and summarize; it cannot approve or execute payments.
- Every payment decision must remain explainable and reproducible.
- Wallet execution is downstream of business policy, not a substitute for it.
- Security and auditability matter more than minimizing table count or service count.

