# Threat Model

Railguard sits between invoice intake and wallet execution, so its primary job is to reduce payment mistakes before funds move.

## Assets

- Workspace configuration and approval thresholds
- Vendor records and approved wallet history
- Invoice documents, extracted fields, and policy evidence
- Payment intent payloads and execution receipts
- Append-only audit events and downloadable exports
- Identity context from WorkOS or local development headers

## Trust Boundaries

1. Browser to frontend: operator interactions, invoice uploads, and approval actions
2. Frontend to API: authenticated tenant-scoped requests
3. API to storage/services: Postgres, object storage, WorkOS, Gemini, Coinbase CDP, Slack, and email
4. Async workers: extraction, audit export generation, and notifications

## Primary Threats

### Cross-tenant data leakage

Risk:
An operator could read or mutate another workspace's invoices, vendors, or payment intents.

Controls:

- Every major table is tenant-scoped by `organization_id`
- API queries filter by the authenticated organization
- Audit events and exports are also tenant-scoped

Residual risk:
Auth hardening still needs a final production pass, so tenant isolation should be re-verified after the auth rollout.

### Malicious or malformed invoice uploads

Risk:
Uploaded content could embed script markers, shell payloads, or poisoned extraction input.

Controls:

- Upload size limits and content-type allowlist
- Basic safety scan before storing the document
- Extraction output is advisory; it never bypasses policy or approvals

Residual risk:
Safety scanning is intentionally lightweight today and should evolve into stronger malware and content validation over time.

### False approvals from weak extraction

Risk:
AI extraction could misread invoice amounts, wallet addresses, or invoice numbers and create unsafe payment intents.

Controls:

- Deterministic policy evaluation runs after extraction
- Low-confidence extraction automatically escalates
- Wallet mismatches, duplicates, unsupported chains/tokens, and hard caps block execution

Residual risk:
Extraction remains probabilistic, so finance operators still need human review for escalated invoices.

### Duplicate or replayed payment execution

Risk:
The same invoice or payment intent could be executed multiple times.

Controls:

- Duplicate invoice detection by invoice hash or invoice number
- Payment intent idempotency keys
- Separate execution idempotency keys for transfer execution
- Audit trail records each transition

Residual risk:
Operational mistakes are still possible if teams intentionally create fresh intents for bad source data, which is why audit review remains important.

### Notification leakage

Risk:
Escalation notifications could expose invoice details to the wrong Slack channel or inbox.

Controls:

- Notification routing is centralized in one worker
- Notification payloads are plain-text summaries, not raw documents
- Secrets are stored in the backend environment instead of the repo

Residual risk:
Destination hygiene is operational, not code-only. Channels and inboxes should be reviewed before demos or customer pilots.

### Credential misuse in external providers

Risk:
Compromised WorkOS, Gemini, Resend, Slack, or CDP credentials could be abused.

Controls:

- Secrets are injected through deployment environments
- CDP execution falls back to demo mode when live credentials are absent
- Wallet execution remains downstream of policy and approval checks

Residual risk:
Rotating credentials and separating staging from production environments are still required operational controls.

## Security Priorities Before Public Rollout

1. Finish the auth hardening pass and remove the current demo-header fallback from deployed environments.
2. Re-run tenant isolation checks after auth changes land.
3. Keep demo and production wallets, orgs, and notification channels separate.
4. Use the verification runbook before every recorded demo or public deploy.
