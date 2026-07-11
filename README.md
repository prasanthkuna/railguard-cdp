# Railguard CDP

[![v0.1-reference](https://img.shields.io/badge/release-v0.1--reference-blue)](https://github.com/prasanthkuna/railguard-cdp/releases/tag/v0.1-reference)
[![tests](https://img.shields.io/badge/API%20tests-bun%20passing-green)](./apps/api/payment-state.test.ts)
[![status](https://img.shields.io/badge/status-reference%20implementation-lightgrey)](https://github.com/prasanthkuna/railguard-new/blob/master/docs/RELEASE_v0.1-reference.md)

Invoice-to-USDC on Base Sepolia via Coinbase CDP — **enforcement boundary #3**.

> **Start here:** [railguard-new PORTFOLIO](https://github.com/prasanthkuna/railguard-new/blob/master/docs/PORTFOLIO.md) — **send only this link** in outreach. Tag: `v0.1-reference`.

![Railguard stack — three boundaries](https://raw.githubusercontent.com/prasanthkuna/railguard-new/master/assets/x-campaign/diagram-boundaries.png)

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
