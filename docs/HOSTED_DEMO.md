# Hosted demo safety (Gate E)

Minimum controls before sharing a public hosted URL.

## Required production settings

### API (Encore)

| Variable | Hosted value | Purpose |
|----------|--------------|---------|
| `ALLOW_DEV_HEADER_AUTH` | `false` | Reject dev header tokens |
| `WORKOS_CLIENT_ID` | set | WorkOS authentication |
| `WORKOS_API_KEY` | set | Token verification |
| `PAYMENT_MODE` | `demo` | No real chain spend on public demo |
| `EXECUTION_KILL_SWITCH` | `false` (or `true` to halt) | Emergency stop |
| `MAX_EXECUTIONS_PER_ORG_HOUR` | `10` | Per-tenant rate limit |
| `DEMO_ORG_ALLOWLIST` | `org_demo_rollout` | Restrict execution to demo tenant |

### Web (Vercel)

| Variable | Hosted value | Purpose |
|----------|--------------|---------|
| `NEXT_PUBLIC_ALLOW_DEV_AUTH` | `false` | Require WorkOS session |
| `NEXT_PUBLIC_DEFAULT_ORG_ID` | demo org only | Tenant isolation |
| `NODE_ENV` | `production` | Disables dev auth by default |

## Authentication behavior

- **Development:** dev header auth enabled unless `ALLOW_DEV_HEADER_AUTH=false`
- **Production:** WorkOS JWT required; dev headers rejected

Frontend mirrors this: `NEXT_PUBLIC_ALLOW_DEV_AUTH=false` on Vercel.

## Execution safety

`executePaymentIntent` checks:

1. **Kill switch** — `EXECUTION_KILL_SWITCH=true` blocks all execution
2. **Org allowlist** — `DEMO_ORG_ALLOWLIST` restricts which tenants can execute
3. **Live acknowledgement** — `PAYMENT_MODE=live` requires `acknowledgeLiveExecution: true`
4. **Rate limit** — default 10 executions/org/hour

## Live mode

Never set `PAYMENT_MODE=live` on a public demo without:

- explicit operator acknowledgement per request
- CDP credentials server-side only (never in browser)
- org allowlist or private deployment

## Audit

Every execution attempt is recorded in the audit trail (`payment_intent` entity events).

## Not required for demo

- HSM / MPC
- SOC 2
- Formal SLA
- Penetration test
- Multi-region failover
