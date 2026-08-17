/** v5 §4–5 — ExecutionRail + canonical lifecycle */

import type { AuthorizationGrant } from "./authority"
import type { FinancialIntent } from "./intent"

export type V5ExecutionStatus =
  | "CREATED"
  | "EVALUATING"
  | "AUTHORIZED"
  | "RESERVED"
  | "EXECUTING"
  | "SUBMITTED"
  | "SETTLED"
  | "DENIED"
  | "APPROVAL_REQUIRED"
  | "FAILED_SAFE"
  | "UNKNOWN"
  | "DISPUTED"
  | "REVERSED"
  | "EXPIRED"

export const V5_TERMINAL_STATUSES: readonly V5ExecutionStatus[] = [
  "SETTLED",
  "DENIED",
  "REVERSED",
  "EXPIRED",
  "FAILED_SAFE",
] as const

export const V5_AMBIGUOUS_STATUSES: readonly V5ExecutionStatus[] = [
  "UNKNOWN",
  "DISPUTED",
] as const

export interface PreparedExecution {
  executionId: string
  rail: string
  providerIdempotencyKey: string
  requestHash: string
  canonicalRequest: Record<string, unknown>
}

export interface ExecutionSubmission {
  executionId: string
  rail: string
  providerOperationId?: string
  txHash?: string
  result: "BROADCAST_CONFIRMED" | "BROADCAST_UNKNOWN" | "REJECTED_BEFORE_BROADCAST"
  responseHash?: string
}

export interface ExecutionObservation {
  executionId: string
  txHash?: string
  settlementStatus: "UNOBSERVED" | "INCLUDED" | "SAFE" | "FINALIZED" | "MISMATCH" | "REVERTED"
  observedAt: string
}

export interface SettlementResult {
  executionId: string
  status: "CLEAN" | "REQUIRED" | "IN_PROGRESS" | "RESOLVED"
  decision: "SETTLED" | "UNKNOWN" | "REVERSED" | "DISPUTED"
  observations: ExecutionObservation[]
}

export interface ExecutionRail {
  readonly name: string
  prepare(intent: FinancialIntent, grant: AuthorizationGrant): Promise<PreparedExecution>
  execute(prepared: PreparedExecution): Promise<ExecutionSubmission>
  observe(submission: ExecutionSubmission): Promise<ExecutionObservation>
  reconcile(executionId: string): Promise<SettlementResult>
}

export function mapLegacyPaymentStatus(status: string): V5ExecutionStatus {
  switch (status) {
    case "prepared":
      return "AUTHORIZED"
    case "executing":
      return "EXECUTING"
    case "executed":
    case "submitted":
      return "SUBMITTED"
    case "confirmed":
      return "SETTLED"
    case "unknown":
      return "UNKNOWN"
    case "reconciliation_required":
      return "DISPUTED"
    case "failed":
      return "FAILED_SAFE"
    case "reverted":
      return "REVERSED"
    default:
      return "EVALUATING"
  }
}

export function requiresReconciliation(status: V5ExecutionStatus): boolean {
  return status === "UNKNOWN" || status === "DISPUTED"
}

export function handleAmbiguousExecution(grantId: string): {
  grantAction: "freeze"
  reconciliation: "enqueue"
  alert: "funds_at_risk"
} {
  return {
    grantAction: "freeze",
    reconciliation: "enqueue",
    alert: "funds_at_risk",
  }
}
