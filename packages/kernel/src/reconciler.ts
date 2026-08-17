/** v5 §13 — reconciliation engine interface */

import type { ExecutionObservation, SettlementResult } from "./executionRail"

export interface ExecutionRecord {
  executionId: string
  organizationId: string
  rail: string
  txHash?: string
  providerOperationId?: string
}

export interface Reconciler {
  observe(execution: ExecutionRecord): Promise<ExecutionObservation[]>
  determine(observations: ExecutionObservation[]): SettlementResult["decision"]
}

export function determineSettlement(observations: ExecutionObservation[]): SettlementResult["decision"] {
  if (observations.length === 0) return "UNKNOWN"
  const reverted = observations.some((o) => o.settlementStatus === "REVERTED")
  if (reverted) return "REVERSED"
  const mismatch = observations.some((o) => o.settlementStatus === "MISMATCH")
  if (mismatch) return "DISPUTED"
  const finalized = observations.every(
    (o) => o.settlementStatus === "FINALIZED" || o.settlementStatus === "SAFE",
  )
  if (finalized) return "SETTLED"
  return "UNKNOWN"
}
