# Grant evidence snapshot (2026-08-08 12:57:10 +05:30)

## WorkOS
- Redirect URIs allowlisted (default: https://prebroadcast.vercel.app/auth/callback)
- Org: PreBroadcast (org_01KZG3PR1SQX5EPF94709V0GD2)
- Operator user: prasanthkuna@gmail.com (Active member)
- Smoke: signed in to https://prebroadcast.vercel.app/ Dashboard (2026-08-08)

## Staging API
- Deploy: 20mluquagip8d37g72ug (Success)
- Commit: b7aac64

## §22 unit proofs
- bun test apps/api/cdpSection22.test.ts apps/api/cdpExecutionDriver.test.ts
- Result: 5 pass / 0 fail

## Deferred (P3 / other Step 4 lanes)
- Outbox → real bus
- BUDGET_AUTHORITY=postgres on SignGate staging
- npm publish / repo rename
- Live vault CDP + KMS

## Staging migrations verified (DB Explorer)
- execution_attempts
- purchases
- quotes
- fulfilments
- outbox_events
- settlement_observations
- healthz revision: b7aac64 / deploy 20mluquagip8d37g72ug

## Console E2E (WorkOS session)
- Dashboard loads for prasanthkuna@gmail.com
- Audit / Vendors / Invoices reachable after auth
