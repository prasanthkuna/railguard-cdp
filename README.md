# Railguard

Pre-payment risk, approval, and audit layer for teams paying vendors in USDC.

This repository is structured as a Bun-powered monorepo for the stack we chose in the PRD:

- `Next.js` for the operator-facing product UI
- `Encore.ts` for backend services and background jobs
- `Postgres` for system-of-record data
- `WorkOS` for org auth, membership, and enterprise-ready identity
- `Coinbase CDP` for demo payment execution on Base Sepolia

## Status

The repo is intentionally scaffolded before implementation. The goal of this first pass is to make the project feel production-minded from the start: clear boundaries, repo hygiene, and docs that keep us moving fast once coding begins.

## Repository Layout

```text
apps/
  api/        Encore.ts backend service entrypoint
  web/        Next.js operator UI
packages/
  audit/      Audit ledger and export logic
  auth/       WorkOS integration and role mapping
  cdp/        Coinbase CDP wrappers and payment execution helpers
  db/         Database schema, queries, and tenancy helpers
  policy/     Deterministic policy evaluation engine
docs/
  architecture/
  runbooks/
prd-v2.md
```

## Getting Started

1. Install Bun `1.3.4` or newer.
2. Copy `.env.example` to `.env`.
3. Fill in local credentials for Postgres, WorkOS, AI extraction, and Coinbase CDP.
4. Scaffold `apps/web` and `apps/api` from this repo structure.

## Engineering Principles

- Deterministic payment policy decisions
- Tenant isolation and explicit org boundaries
- Append-only audit evidence
- Idempotent payment operations
- Clear separation between business policy and wallet execution

## Near-Term Build Order

1. Scaffold `apps/web` with Next.js and the initial operator UI shell.
2. Scaffold `apps/api` with Encore.ts services for invoices, vendors, policy, approvals, payments, and audit.
3. Stand up Postgres and wire in tenancy-safe data access.
4. Implement invoice ingestion, extraction, and policy evaluation.
5. Add WorkOS-backed auth and role mapping.
6. Add CDP demo execution on Base Sepolia.

## Docs

- Product requirements: [prd-v2.md](./prd-v2.md)
- Architecture overview: [docs/architecture/overview.md](./docs/architecture/overview.md)
- Local setup notes: [docs/runbooks/local-setup.md](./docs/runbooks/local-setup.md)

