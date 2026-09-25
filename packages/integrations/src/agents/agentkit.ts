/**
 * Coinbase AgentKit — hiring integration surface.
 * Wire AgentKit wallet actions through Railguard MCP (authorize → execute → verify).
 */

export const AGENTKIT_INTEGRATION = {
  mcpServer: "bun run railguard:mcp",
  tools: [
    "railguard_create_intent",
    "railguard_authorize",
    "railguard_execute",
    "railguard_verify",
    "railguard_pay",
  ],
  docs: "https://github.com/prasanthkuna/railguard-cdp/blob/main/docs/INTEGRATION.md",
}

export function agentKitToolManifest() {
  return AGENTKIT_INTEGRATION
}
