# @railguard/cli

Operator and CI CLI for Railguard v5.

## Install (monorepo)

```powershell
cd c:\Users\PrashanthKuna\coinbase
bun install
```

## Usage

```powershell
$env:RAILGUARD_ACCESS_TOKEN = "<token>"
$env:RAILGUARD_BASE_URL = "http://localhost:4000"

bun run railguard doctor
bun run railguard verify
bun run railguard lab run --suite cdp-section22
bun run railguard metrics
bun run railguard evidence exec_...
bun run railguard intent create intent.json
bun run railguard authorize fin_...
bun run railguard execute fin_... --payment-intent-id pay_...
bun run railguard pay intent.json
```

## Commands

| Command | Auth | Description |
|---------|------|-------------|
| `doctor` | No | Environment checklist |
| `verify` | Demo script | Full invoice→pay→audit flow |
| `lab` | External | Agent Payment Failure Lab |
| `metrics` | Yes | Financial SRE metrics |
| `evidence` | Yes | Evidence envelope + explain |
| `intent create` | Yes | POST /v1/intents |
| `authorize` | Yes | POST /v1/intents/:id/authorize |
| `execute` | Yes | POST /v1/intents/:id/execute |
| `pay` | Yes | authorize → execute → verify |

See also `@railguard/mcp` for Cursor/Codex agent integrations.
