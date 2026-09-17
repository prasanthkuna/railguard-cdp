/** Base ExecutionRail — alias of CDP path on Base Sepolia (v5 §5) */
import { type CdpRailConfig, createCdpExecutionRail } from "./cdpRail"

export function createBaseExecutionRail(config: CdpRailConfig) {
  const rail = createCdpExecutionRail(config)
  return { ...rail, name: "base" as const }
}
