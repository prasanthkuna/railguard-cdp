/** v5 §5 — rail registry (Core + x402 + CDP/Base only for now) */

import type { ExecutionRail } from "./executionRail"

export type SupportedRailName = "x402" | "cdp" | "base"

export const V5_SUPPORTED_RAILS: readonly SupportedRailName[] = ["x402", "cdp", "base"] as const

export const V5_DEFERRED_RAILS = [
  "arc",
  "solana",
  "stellar",
  "stripe",
  "mandates/ap2",
] as const

export class ExecutionRailRegistry {
  private readonly rails = new Map<string, ExecutionRail>()

  register(rail: ExecutionRail): void {
    this.rails.set(rail.name, rail)
  }

  get(name: string): ExecutionRail | undefined {
    return this.rails.get(name)
  }

  list(): string[] {
    return [...this.rails.keys()]
  }
}

export function createDefaultRailRegistry(): ExecutionRailRegistry {
  return new ExecutionRailRegistry()
}
