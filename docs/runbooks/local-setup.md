# Local Setup

## Prerequisites

- Bun `1.3.4` or newer
- Node.js `18+`
- Docker running locally so Encore can provision Postgres
- Encore CLI installed

## Environment

Start from `.env.example` and fill in:

- app URL
- frontend API URL
- database connection
- redis connection
- WorkOS credentials
- AI extraction provider key
- Coinbase CDP secrets
- notification credentials

## Commands

1. Install dependencies with `bun install`.
2. Start the backend with `bun run dev:api`.
3. Start the web app with `bun run dev:web`.
4. Run repo checks with `bun run check`.
5. Lint only with `bun run lint`.
6. Run unit tests with `bun run test`.

## Local auth headers

The backend expects these headers for authenticated endpoints:

- `Authorization: Bearer demo-token`
- `X-Organization-Id: org_demo`
- `X-Role: owner`

## Current backend scope

- vendor registry and wallet history
- invoice intake and deterministic policy evaluation
- approvals for escalations
- payment-intent creation and demo execution
- append-only audit trail retrieval
