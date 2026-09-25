/** OpenClaw distribution — MCP endpoint config stub. */

export function openClawMcpConfig(baseUrl: string, token: string) {
  return {
    mcpServers: {
      railguard: {
        command: "bun",
        args: ["run", "railguard:mcp"],
        env: {
          RAILGUARD_BASE_URL: baseUrl,
          RAILGUARD_ACCESS_TOKEN: token,
        },
      },
    },
  }
}
