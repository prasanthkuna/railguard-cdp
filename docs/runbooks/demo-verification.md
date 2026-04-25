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

The script reads local `.env` or `.env.local` values by default. Override the target explicitly for deployed environments:

```bash
RAILGUARD_BASE_URL=https://staging-railguard-s4ii.encr.app bun run verify:demo
```

Optional overrides:

- `RAILGUARD_ORG_ID`
- `RAILGUARD_WORKSPACE_NAME`
- `RAILGUARD_OWNER_EMAIL`
- `RAILGUARD_RUN_ID`

If you do not provide `RAILGUARD_ORG_ID` and the workspace does not exist yet, the script bootstraps a new workspace and continues with the returned organization id.

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
