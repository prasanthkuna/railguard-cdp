# Demo Verification Runbook

Use this runbook to seed a realistic workspace and prove the non-auth product flows before a demo, QA pass, or rollout review.

## What This Covers

- organization workspace setup
- vendor and wallet registry
- allow, block, and escalate policy outcomes
- approval flow
- payment intent creation and execution
- invoice upload and extraction
- CSV and PDF audit export generation
- dashboard counter validation

## Command

```bash
bun run verify:demo
```

Default mode is `curated`, which seeds into a fresh org id (`org_curated_<runID>`) so recording data stays clean and non-duplicative.

The script reads local `.env` or `.env.local` values by default. Override the target explicitly for deployed environments:

```bash
RAILGUARD_BASE_URL=https://staging-railguard-s4ii.encr.app bun run verify:demo
```

Optional overrides:

- `RAILGUARD_MODE` (`curated`, `stress`, or `showcase`)
- `RAILGUARD_ORG_ID`
- `RAILGUARD_WORKSPACE_NAME`
- `RAILGUARD_OWNER_EMAIL`
- `RAILGUARD_RUN_ID`
- `RAILGUARD_ACCESS_TOKEN` / `RAILGUARD_REFRESH_TOKEN` (required for `showcase` on WorkOS staging)

Recommended usage:

```bash
# Clean curated dataset for videos (demo header auth / local)
RAILGUARD_MODE=curated RAILGUARD_BASE_URL=https://staging-railguard-s4ii.encr.app bun run verify:demo

# Repeatable stress validation against the long-lived org
RAILGUARD_MODE=stress RAILGUARD_ORG_ID=org_demo_rollout RAILGUARD_BASE_URL=https://staging-railguard-s4ii.encr.app bun run verify:demo

# Seed PreBroadcast org with realistic ops data (WorkOS bearer)
# Capture tokens from Chrome localStorage `railguard_auth_session` while logged in.
RAILGUARD_MODE=showcase `
  RAILGUARD_BASE_URL=https://staging-railguard-s4ii.encr.app `
  RAILGUARD_ORG_ID=org_01KZG3PR1SQX5EPF94709V0GD2 `
  RAILGUARD_REFRESH_TOKEN=<from localStorage> `
  bun run verify:demo
```

Showcase naming is production-like (e.g. Northline Logistics / `NL-4821`) — no `DEMO-*` labels. The script prints a terminal cheat sheet only.

## Expected Proof Points

1. An approved vendor invoice lands as `allow` and becomes `ready`.
2. A policy simulation forces that invoice into `escalate` by lowering the review threshold.
3. A pending-vendor invoice escalates and then moves through approval.
4. A duplicate invoice with a changed wallet is blocked.
5. An approved invoice produces a payment intent and executes successfully.
6. A synthetic uploaded invoice is extracted into a real invoice record.
7. CSV and PDF audit exports complete and return download URLs.
8. Dashboard counters reflect blocked and protected payment activity.

## Notes

- This runbook intentionally avoids the final auth-hardening workstream. Auth cleanup and re-verification happen after these flows are stable.
- Non-allow policy outcomes may trigger notification workers in environments where Slack and email secrets are configured.
- If live CDP credentials are configured, execution uses Base Sepolia. Without them, the backend falls back to demo transaction hashes.
