# Railguard monorepo layout (v5 §17)

```
coinbase/   ← primary v5 monorepo (github.com/railguard/railguard target)
├── apps/
│   ├── api/          Encore control plane
│   ├── web/          Operator console (v5 evidence UI)
│   └── demo-agent/   SDK demo entry
├── packages/
│   ├── kernel/       FinancialIntent, Authority, Execution, Evidence
│   ├── authority/    Re-export layer
│   ├── execution/
│   ├── evidence/
│   ├── reconciliation/
│   ├── observability/
│   ├── sdk/
│   ├── cli/
│   └── mcp/
├── adapters/         See packages/kernel/src/adapters/
├── examples/
│   ├── vendor-payment-agent/
│   ├── x402-agent/
│   ├── procurement-agent/
│   └── api-buying-agent/
├── labs/failure-suite/
└── docs/
```

## Archived repos (banner only — history preserved)

- **x402-guard** → adapter inside this monorepo (`vendor/x402-guard`)
- **railguard-cdp** → `examples/vendor-payment-agent` + `apps/demo-agent`

Do not develop three independent architectures.
