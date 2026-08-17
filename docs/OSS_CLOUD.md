# OSS vs Railguard Cloud (v5 §16)

## Open source

- `FinancialIntent` schema — `@railguard/kernel`
- SDK — `@railguard/sdk`, `@railguard/cli`, `@railguard/mcp`
- Adapter interfaces — `ExecutionRail`, mandate normalizers
- x402 / CDP / Base adapters
- Execution state machine + UNKNOWN handling
- Evidence schema + explain API
- Failure / conformance suite — `labs/failure-suite/`
- Solidity contracts — `railguard-new/signgate/` (optional high-assurance mode)
- Local policy engine — `@railguard/policy`, x402-guard adapter

## Railguard Cloud (commercial)

- Hosted authority service
- Durable hierarchical budgets (Postgres)
- Enterprise policy management
- Managed reconciliation + settlement quorum
- Approval workflows
- Key custody integrations
- Dashboard (`apps/web`)
- Alerts + financial metrics API
- Compliance exports
- Organization RBAC
- Long-term evidence storage + SLA
