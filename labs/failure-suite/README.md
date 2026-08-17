# Railguard Certified Executor — Failure Suite

OSS conformance lab for agent payment executors. Implements v5 §15.

## Primary lab

Run the Agent Payment Failure Lab:

```powershell
cd c:\Users\PrashanthKuna\agent-payment-failure-lab
apf-lab run --suite cdp-section22
```

## Scenarios covered (v4/v5)

| Scenario | Expectation |
|----------|-------------|
| CDP §22 drop response | Status → `UNKNOWN`, funds frozen, reconcile before retry |
| Idempotent re-execute | Same idempotency key → same result |
| Policy deny | No execution, evidence records deny |
| Budget exceed | Reservation denied |

## Integration with Railguard

- Kernel UNKNOWN handling: `packages/kernel/src/executionRail.ts`
- API tests: `apps/api/cdpSection22.test.ts`
- Demo verify: `bun run verify:demo` from `coinbase/`

## Conformance badge

Future: publish `labs/failure-suite/conformance.json` listing passing rails. Not required for v5 core ship.
