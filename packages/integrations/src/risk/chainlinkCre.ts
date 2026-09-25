import type { RiskSignalInput, RiskSignalProvider, RiskSignalResult } from "./types"

/** Chainlink CRE — composable risk workflows (env: CHAINLINK_CRE_WEBHOOK_URL). */
export function createChainlinkCreRiskProvider(): RiskSignalProvider {
  return {
    name: "chainlink-cre",
    async evaluate(input: RiskSignalInput): Promise<RiskSignalResult> {
      const webhook = process.env.CHAINLINK_CRE_WEBHOOK_URL?.trim()
      if (!webhook) {
        return { provider: "chainlink-cre", level: "UNKNOWN", labels: ["provider_not_configured"] }
      }
      try {
        const res = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        })
        if (!res.ok) {
          return { provider: "chainlink-cre", level: "UNKNOWN", labels: [`http_${res.status}`] }
        }
        const json = (await res.json()) as { level?: string; labels?: string[] }
        return {
          provider: "chainlink-cre",
          level: (json.level as RiskSignalResult["level"]) ?? "LOW",
          labels: json.labels ?? ["cre_response"],
          raw: json as Record<string, unknown>,
        }
      } catch {
        return { provider: "chainlink-cre", level: "UNKNOWN", labels: ["fetch_failed"] }
      }
    },
  }
}
