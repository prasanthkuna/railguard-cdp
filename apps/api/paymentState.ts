/** Pure payment state helpers — tested invariants for CDP execution/reconciliation. */

export const RECONCILE_CANDIDATE_STATUSES = ["submitted", "unknown"] as const

export type ReconcileCandidateStatus = (typeof RECONCILE_CANDIDATE_STATUSES)[number]

/** After broadcast, never classify as failed — ambiguous until chain truth converges. */
export function terminalStatusAfterBroadcastFailure(
  broadcastedTxHash: string | undefined,
): "unknown" | "failed" {
  return broadcastedTxHash ? "unknown" : "failed"
}

/** Execution retry must not proceed while reconciliation is required. */
export function isExecutionRetryBlocked(status: string): boolean {
  return status === "unknown" || status === "submitted"
}

/** Idempotent execute returns existing row without re-broadcasting. */
export function isIdempotentExecutionReturn(status: string): boolean {
  return (
    status === "executed" ||
    status === "executing" ||
    status === "submitted" ||
    status === "unknown" ||
    status === "confirmed"
  )
}

export function isReconcileCandidate(status: string, txHash: string | null): boolean {
  return (
    RECONCILE_CANDIDATE_STATUSES.includes(status as ReconcileCandidateStatus) && Boolean(txHash)
  )
}
