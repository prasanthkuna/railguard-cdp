import {
  guardStatusAfterCommit,
  guardStatusAfterRelease,
  mapSettlementVerificationToLifecycle,
  shouldReleaseGuardOnExecutionFailure,
  type SettlementVerificationStatus,
} from "./lifecycle"

export interface PaymentCorrelationFacts {
  paymentIdentifier: string
  guardFingerprint?: string
  guardAuthorizationId?: string
  guardReceiptId?: string
  expectedChainId: string
  expectedToken: string
  expectedSender: string
  expectedRecipient: string
  expectedAmount: string
}

export interface ReconciliationTransition {
  paymentStatus?: "confirmed" | "reverted" | "reconciliation_required" | "unknown"
  settlementStatus?: "pending" | "confirmed" | "reverted" | "reconciliation_required"
  guardStatus?: "committed" | "released" | "frozen"
  shouldCommitGuard: boolean
  shouldReleaseGuard: boolean
  shouldRecordSettlement: boolean
}

export function buildPaymentIdentifier(
  paymentIntentId: string,
  executionIdempotencyKey: string,
): string {
  return `${paymentIntentId}:${executionIdempotencyKey}`
}

export function buildPaymentResourceUrl(paymentIntentId: string): string {
  return `https://railguard.local/payment-intents/${paymentIntentId}`
}

export function transitionAfterExecutionFailure(input: {
  broadcastedTxHash?: string
  guardAuthorizationId?: string
}): {
  paymentStatus: "unknown" | "failed"
  guardStatus?: "released" | "frozen"
  releaseGuard: boolean
} {
  const paymentStatus = input.broadcastedTxHash ? "unknown" : "failed"
  const releaseGuard = shouldReleaseGuardOnExecutionFailure(input.broadcastedTxHash)
  return {
    paymentStatus,
    guardStatus: input.guardAuthorizationId ? (releaseGuard ? "released" : "frozen") : undefined,
    releaseGuard,
  }
}

export function transitionAfterSettlementVerification(
  verificationStatus: SettlementVerificationStatus,
  guardAuthorizationId?: string,
  alreadyCommitted = false,
): ReconciliationTransition {
  const mapped = mapSettlementVerificationToLifecycle(verificationStatus)
  switch (verificationStatus) {
    case "CONFIRMED":
      return {
        paymentStatus: "confirmed",
        settlementStatus: mapped.settlementStatus,
        guardStatus: guardAuthorizationId && !alreadyCommitted ? guardStatusAfterCommit() : undefined,
        shouldCommitGuard: Boolean(guardAuthorizationId && !alreadyCommitted),
        shouldReleaseGuard: false,
        shouldRecordSettlement: true,
      }
    case "REVERTED":
      return {
        paymentStatus: "reverted",
        settlementStatus: mapped.settlementStatus,
        guardStatus: guardAuthorizationId ? guardStatusAfterRelease() : undefined,
        shouldCommitGuard: false,
        shouldReleaseGuard: Boolean(guardAuthorizationId),
        shouldRecordSettlement: false,
      }
    case "RECONCILIATION_REQUIRED":
      return {
        paymentStatus: "reconciliation_required",
        settlementStatus: mapped.settlementStatus,
        guardStatus: guardAuthorizationId ? "frozen" : undefined,
        shouldCommitGuard: false,
        shouldReleaseGuard: false,
        shouldRecordSettlement: false,
      }
    default:
      return {
        settlementStatus: "pending",
        shouldCommitGuard: false,
        shouldReleaseGuard: false,
        shouldRecordSettlement: false,
      }
  }
}
