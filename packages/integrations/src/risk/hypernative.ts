import type { RiskSignalInput, RiskSignalProvider, RiskSignalResult } from "./types"

/** Hypernative — agentic payment security (env: HYPERNATIVE_API_KEY). */
export function createHypernativeRiskProvider(): RiskSignalProvider {
  return {
    name: "hypernative",
    async evaluate(input: RiskSignalInput): Promise<RiskSignalResult> {
      if (!process.env.HYPERNATIVE_API_KEY?.trim()) {
        return { provider: "hypernative", level: "UNKNOWN", labels: ["provider_not_configured"] }
      }
      return {
        provider: "hypernative",
        level: "LOW",
        labels: ["stub_live_key_present"],
        raw: { to: input.to },
      }
    },
  }
}
