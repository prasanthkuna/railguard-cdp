# Vendor Payment Agent (v5 example)

Former **railguard-cdp** demo path — invoice → authorize → execute → evidence.

```powershell
cd c:\Users\PrashanthKuna\coinbase
bun run verify:demo
```

Uses legacy invoice flow which auto-creates v5 `FinancialIntent` via `apps/api/v5Bridge.ts`.

See also: `apps/demo-agent/` for SDK-only flow.
