# @railguard/mcp

Model Context Protocol server exposing Railguard v5 verbs as agent tools.

Uses a lightweight stdio JSON-RPC implementation (no `@modelcontextprotocol/sdk` dependency) so it stays outside the Encore API typecheck path while remaining fully MCP-compatible for Cursor and Claude Desktop.

## Cursor setup

Add to `.cursor/mcp.json` (or global MCP settings):

```json
{
  "mcpServers": {
    "railguard": {
      "command": "bun",
      "args": ["run", "c:/Users/PrashanthKuna/coinbase/packages/mcp/src/server.ts"],
      "env": {
        "RAILGUARD_BASE_URL": "http://localhost:4000",
        "RAILGUARD_ACCESS_TOKEN": "<your-token>"
      }
    }
  }
}
```

From monorepo root after `bun install`:

```json
{
  "mcpServers": {
    "railguard": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/server.ts"],
      "env": {
        "RAILGUARD_BASE_URL": "http://127.0.0.1:4000",
        "RAILGUARD_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
```

## Tools

| Tool | Maps to |
|------|---------|
| `railguard_doctor` | Environment check |
| `railguard_create_intent` | POST /v1/intents |
| `railguard_authorize` | POST /v1/intents/:id/authorize |
| `railguard_execute` | POST /v1/intents/:id/execute |
| `railguard_verify` | GET /v1/executions/:id/evidence |
| `railguard_pay` | Full pay flow |
| `railguard_get_execution` | GET /v1/executions/:id |
| `railguard_financial_metrics` | GET /v1/metrics/financial |

## Run manually

```powershell
$env:RAILGUARD_ACCESS_TOKEN = "<token>"
bun run packages/mcp/src/server.ts
```

Uses stdio transport (standard MCP).
