import { createBlockaidRiskProvider } from "./blockaid"
import { createChainlinkCreRiskProvider } from "./chainlinkCre"
import { createGoPlusRiskProvider } from "./goplus"
import { createHypernativeRiskProvider } from "./hypernative"
import type { RiskSignalInput, RiskSignalProvider, RiskSignalResult } from "./types"

export * from "./types"
export { createBlockaidRiskProvider, createHypernativeRiskProvider, createGoPlusRiskProvider, createChainlinkCreRiskProvider }

export function createDefaultRiskPanel(): RiskSignalProvider[] {
  return [
    createBlockaidRiskProvider(),
    createHypernativeRiskProvider(),
    createGoPlusRiskProvider(),
    createChainlinkCreRiskProvider(),
  ]
}

export async function evaluateRiskPanel(
  providers: RiskSignalProvider[],
  input: RiskSignalInput,
): Promise<RiskSignalResult[]> {
  return Promise.all(providers.map((p) => p.evaluate(input)))
}

export function worstRiskLevel(results: RiskSignalResult[]): RiskSignalResult["level"] {
  const order = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const
  for (const level of order) {
    if (results.some((r) => r.level === level)) return level
  }
  return "UNKNOWN"
}
