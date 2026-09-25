# Coinbase AgentKit

Point AgentKit tools at Railguard MCP:

```json
{
  "mcpServers": {
    "railguard": {
      "command": "bun",
      "args": ["run", "railguard:mcp"],
      "env": {
        "RAILGUARD_BASE_URL": "https://staging-railguard-s4ii.encr.app",
        "RAILGUARD_ACCESS_TOKEN": "<token>"
      }
    }
  }
}
```

See `packages/integrations/src/agents/agentkit.ts`.
