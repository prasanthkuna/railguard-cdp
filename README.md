# Railguard CDP

Invoice-to-USDC on Base Sepolia via Coinbase CDP — **enforcement boundary #3** (human approvals, broadcast truth, reconciliation).

> **Railguard stack:** [railguard-new PORTFOLIO](https://github.com/prasanthkuna/railguard-new/blob/master/docs/PORTFOLIO.md) — one-page story, source-of-truth table, demo scripts.

## Sibling repos

| Repo | Role |
|------|------|
| [railguard-new](https://github.com/prasanthkuna/railguard-new) | On-chain hook + SignGate session enforcement |
| [x402-guard](https://github.com/prasanthkuna/x402-guard) | Pre-sign agent payment policy (`authorizePayment`) |

**CDP vs hook:** This repo proves invoice approval, CDP execution, and post-broadcast reconciliation. The hook in railguard-new proves smart-account-native caps. v0.1 shares policy/audit primitives; full CDP→smart-account routing is future hardening.

## x402-guard integration

Set `X402_GUARD_ENABLED=true` before API start. CI checks out sibling [x402-guard](https://github.com/prasanthkuna/x402-guard) and builds packages automatically.

```powershell
# Local: junction or clone x402-guard inside coinbase/
cd coinbase
bun install
cd x402-guard/packages/core; bun run build
cd ../policy; bun run build
cd ../middleware; bun run build
cd ../../..
$env:X402_GUARD_ENABLED = "true"
bun run dev:api
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `PAYMENT_MODE` | `demo` or `live` (required before execute) |
| `X402_GUARD_ENABLED` | `true` to gate payments with x402-guard |
| `CDP_CONFIRMATION_DEPTH` | Chain confirmations before confirmed (default `1`) |

## Tests

```powershell
bun run lint
bun test apps/api packages
encore check
```

Key invariant tests: `apps/api/payment-state.test.ts`, `apps/api/execution-claim.test.ts`

## Remotes

- `github` — https://github.com/prasanthkuna/railguard-cdp (this repo)
- `encore` — Encore Cloud deploy target
- `origin` — archived legacy `prasanthkuna/railguard`
