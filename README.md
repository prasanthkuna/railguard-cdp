# Railguard CDP

Private product repo — invoice-to-USDC on Base Sepolia via CDP.

## Sibling repos

| Repo | Role |
|------|------|
| [railguard-new](https://github.com/prasanthkuna/railguard-new) | On-chain ERC-7579 hook + SignGate |
| [x402-guard](https://github.com/prasanthkuna/x402-guard) | Pre-sign agent payment policy |

## x402-guard integration

Set `X402_GUARD_ENABLED=true` before API start. See `docs/integrations/x402-guard.md`.

```powershell
cd ..\x402-guard; npm run build
cd ..\coinbase
$env:X402_GUARD_ENABLED = "true"
bun run dev:api
```

## Remotes

- `github` — https://github.com/prasanthkuna/railguard-cdp (this repo)
- `encore` — Encore Cloud deploy target
- `origin` — archived legacy `prasanthkuna/railguard`
