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
      // Production: POST https://api.blockaid.io/v0/...
      return {
        provider: "blockaid",
        level: "LOW",
        labels: ["stub_live_key_present"],
        raw: { to: input.to, chainId: input.chainId },
      }
    },
  }
}
