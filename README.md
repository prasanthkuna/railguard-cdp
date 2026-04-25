# Railguard

Pre-payment risk, approval, and audit layer for teams paying vendors in USDC.

This repository is structured as a Bun-powered monorepo for the stack we chose in the PRD:

- `Next.js` for the operator-facing product UI
- `Encore.ts` for backend services and background jobs
- `Postgres` for system-of-record data
- `WorkOS` for org auth, membership, and enterprise-ready identity
- `Coinbase CDP` for demo payment execution on Base Sepolia

## Status

The repository now includes a working Encore.ts backend and a Next.js operator console covering dashboard, invoice intake, vendor management, approvals, payment intent review, and audit exports.

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
2. Install the Encore CLI.
3. Copy `.env.example` to `.env`.
4. Fill in credentials for Postgres, WorkOS, AI extraction, Coinbase CDP, and notifications.
5. Run `bun install`.
6. Start the backend with `bun run dev:api`.
7. Start the web app with `bun run dev:web`.

## Engineering Principles

- Deterministic payment policy decisions
- Tenant isolation and explicit org boundaries
- Append-only audit evidence
- Idempotent payment operations
- Clear separation between business policy and wallet execution

## Validation

- `bun run lint`
- `bun run test`
- `bun run typecheck`
- `bun run build:web`

PRs and pushes to `main` run the same checks in GitHub Actions.

## Docs

- Product requirements: [prd-v2.md](./prd-v2.md)
- Architecture overview: [docs/architecture/overview.md](./docs/architecture/overview.md)
- Local setup notes: [docs/runbooks/local-setup.md](./docs/runbooks/local-setup.md)
