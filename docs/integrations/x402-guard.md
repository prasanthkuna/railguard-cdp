# x402-guard integration

Autonomous agent payments (x402 roadmap in `prd-v2.md`) use `@x402-guard/middleware` **before** CDP wallet execution when enabled.

## Layering

| Layer | Package | Repo |
|-------|---------|------|
| Business policy (invoice/vendor) | `@railguard/policy` | this repo |
| Agent payment guard | `@x402-guard/middleware` | `../x402-guard` |
| Wallet execution | `@coinbase/cdp-sdk` | this repo |

## Flow

```
POST /payment-intents/:id/execute
  → ensurePayable() [@railguard/policy]
  → evaluatePaymentGuard() [@x402-guard/middleware]  (if X402_GUARD_ENABLED=true)
  → executeCdpTransfer()
  → recordPaymentSettlement() + audit events
```

## Enable locally

```powershell
# Build sibling repo first
cd ..\x402-guard
npm install && npm run build

cd ..\coinbase
bun install
$env:X402_GUARD_ENABLED = "true"
bun run dev:api
```

## Files

| File | Role |
|------|------|
| `apps/api/x402Guard.ts` | Guard wrapper + org-scoped policy |
| `apps/api/api.ts` | `executePaymentIntent` choke point |
| `apps/api/package.json` | `file:` link to x402-guard middleware |

## Status

- [x] Import guard in payment intent path (`X402_GUARD_ENABLED=true`)
- [x] Audit events on evaluate + settle (`x402_guard.evaluated`, `x402_guard.settled`)
- [ ] Map invoice policy + agent policy for hybrid flows (deferred — invoice path unchanged)
- [ ] Dedicated agent/x402 HTTP endpoint (post-v1)
- [ ] Audit export zip includes guard JSONL export
