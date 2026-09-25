import type { RiskSignalInput, RiskSignalProvider, RiskSignalResult } from "./types"

/** Blockaid — simulation / malicious tx signals (env: BLOCKAID_API_KEY). */
export function createBlockaidRiskProvider(): RiskSignalProvider {
  return {
    name: "blockaid",
    async evaluate(input: RiskSignalInput): Promise<RiskSignalResult> {
      const key = process.env.BLOCKAID_API_KEY?.trim()
      if (!key) {
        return {
          provider: "blockaid",
          level: "UNKNOWN",
          labels: ["provider_not_configured"],
        }
      }
      try {
        const res = await fetch("https://api.blockaid.io/v0/evm/json-rpc/scan", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "X-API-Key": key,
          },
          body: JSON.stringify({
            chain: `0x${input.chainId.toString(16)}`,
            data: {
              method: "eth_call",
              params: [{ to: input.to, data: "0x" }],
            },
            metadata: { domain: "railguard-testnet" },
          }),
        })
        if (!res.ok) {
          return {
            provider: "blockaid",
            level: "UNKNOWN",
            labels: [`http_${res.status}`],
          }
        }
        const json = (await res.json()) as { validation?: { status?: string } }
        const status = json.validation?.status ?? "unknown"
        const level =
          status === "Success" || status === "Benign"
            ? "LOW"
            : status === "Warning"
              ? "MEDIUM"
              : "HIGH"
        return { provider: "blockaid", level, labels: [status], raw: json }
      } catch {
        return { provider: "blockaid", level: "UNKNOWN", labels: ["fetch_failed"] }
      }
    },
  }
}
