# Agent integration surfaces

Railguard exposes three integration paths for humans, scripts, and AI agents.

## Comparison

| Surface | Best for | Package |
|---------|----------|---------|
| **REST v1 API** | Backend services, web console | `apps/api/v5Api.ts` |
| **SDK** | TypeScript apps, examples | `@railguard/sdk` |
| **CLI** | CI, demos, operators | `@railguard/cli` |
| **MCP** | Cursor, Codex, Claude Desktop agents | `@railguard/mcp` |

All paths implement the same three verbs: **authorize → execute → verify**.

## Quick start

```powershell
cd c:\Users\PrashanthKuna\coinbase
bun install

# Terminal 1 — API
bun run dev:api

# Terminal 2 — CLI
$env:RAILGUARD_ACCESS_TOKEN = "<token>"
bun run railguard doctor
bun run railguard verify

# MCP — add docs/mcp-cursor.example.json to Cursor MCP settings
bun run railguard:mcp
```

## Environment variables

| Variable | Used by | Default |
|----------|---------|---------|
| `RAILGUARD_BASE_URL` | CLI, MCP, SDK examples | `http://localhost:4000` |
| `RAILGUARD_ACCESS_TOKEN` | CLI, MCP (authenticated calls) | — |
| `PAYMENT_MODE` | API | `demo` for local dev |
| `X402_GUARD_ENABLED` | API authority path | `false` locally |

## OSS boundary

CLI, SDK, and MCP are open-source integration layers. Hosted authority, budgets, reconciliation, and SLA remain Railguard Cloud. See [OSS_CLOUD.md](./OSS_CLOUD.md).
