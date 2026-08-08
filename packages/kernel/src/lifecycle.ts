/** Pure payment lifecycle helpers shared across Railguard apps. */

export const RECONCILE_CANDIDATE_STATUSES = [
  "submitted",
  "unknown",
  "reconciliation_required",
] as const

export type ReconcileCandidateStatus = (typeof RECONCILE_CANDIDATE_STATUSES)[number]

export type GuardLifecycleStatus = "reserved" | "committed" | "released" | "frozen"

export type SettlementLifecycleStatus =
  | "pending"
  | "confirmed"
  | "reverted"
  | "reconciliation_required"

export type SettlementVerificationStatus =
  | "CONFIRMED"
  | "REVERTED"
  | "RECONCILIATION_REQUIRED"
  | "PENDING"

export function terminalStatusAfterBroadcastFailure(
  broadcastedTxHash: string | undefined,
): "unknown" | "failed" {
  return broadcastedTxHash ? "unknown" : "failed"
}

export function shouldReleaseGuardOnExecutionFailure(
  broadcastedTxHash: string | undefined,
): boolean {
  return !broadcastedTxHash
}

export function isExecutionRetryBlocked(status: string): boolean {
  return status === "unknown" || status === "submitted" || status === "reconciliation_required"
}

export function isIdempotentExecutionReturn(status: string): boolean {
  return (
    status === "executed" ||
    status === "executing" ||
    status === "submitted" ||
    status === "unknown" ||
    status === "confirmed" ||
    status === "reconciliation_required"
  )
}

export function isReconcileCandidate(status: string, txHash: string | null): boolean {
  return (
    RECONCILE_CANDIDATE_STATUSES.includes(status as ReconcileCandidateStatus) && Boolean(txHash)
  )
}

export function guardStatusAfterBroadcast(): GuardLifecycleStatus {
  return "frozen"
}

export function guardStatusAfterCommit(): GuardLifecycleStatus {
  return "committed"
}

export function guardStatusAfterRelease(): GuardLifecycleStatus {
  return "released"
}

export function guardStatusAfterReserve(): GuardLifecycleStatus {
  return "reserved"
}

export function mapSettlementVerificationToLifecycle(
  status: SettlementVerificationStatus,
): {
  paymentStatus?: "confirmed" | "reverted" | "reconciliation_required"
  settlementStatus?: SettlementLifecycleStatus
} {
  switch (status) {
    case "CONFIRMED":
      return { paymentStatus: "confirmed", settlementStatus: "confirmed" }
    case "REVERTED":
      return { paymentStatus: "reverted", settlementStatus: "reverted" }
    case "RECONCILIATION_REQUIRED":
      return {
        paymentStatus: "reconciliation_required",
        settlementStatus: "reconciliation_required",
      }
    default:
      return { settlementStatus: "pending" }
  }
}
