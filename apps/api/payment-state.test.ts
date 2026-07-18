import { describe, expect, it } from "bun:test"
import {
  buildPaymentIdentifier,
  transitionAfterExecutionFailure,
  transitionAfterSettlementVerification,
} from "./paymentReconciliation"
import {
  guardStatusAfterBroadcast,
  guardStatusAfterReserve,
  isExecutionRetryBlocked,
  isIdempotentExecutionReturn,
  isReconcileCandidate,
  shouldReleaseGuardOnExecutionFailure,
  terminalStatusAfterBroadcastFailure,
} from "./paymentState"

describe("payment state machine invariants", () => {
  it("post-broadcast failure becomes unknown, not failed", () => {
    expect(terminalStatusAfterBroadcastFailure("0xabc")).toBe("unknown")
    expect(terminalStatusAfterBroadcastFailure(undefined)).toBe("failed")
  })

  it("keeps guard frozen after broadcast failure", () => {
    const transition = transitionAfterExecutionFailure({
      broadcastedTxHash: "0xabc",
      guardAuthorizationId: "auth-1",
    })
    expect(transition.paymentStatus).toBe("unknown")
    expect(transition.releaseGuard).toBe(false)
    expect(transition.guardStatus).toBe("frozen")
  })

  it("releases guard only when broadcast did not occur", () => {
    expect(shouldReleaseGuardOnExecutionFailure(undefined)).toBe(true)
    expect(shouldReleaseGuardOnExecutionFailure("0xabc")).toBe(false)
    const transition = transitionAfterExecutionFailure({
      guardAuthorizationId: "auth-1",
    })
    expect(transition.paymentStatus).toBe("failed")
    expect(transition.releaseGuard).toBe(true)
    expect(transition.guardStatus).toBe("released")
  })

  it("blocks retry while submitted, unknown, or reconciliation_required", () => {
    expect(isExecutionRetryBlocked("submitted")).toBe(true)
    expect(isExecutionRetryBlocked("unknown")).toBe(true)
    expect(isExecutionRetryBlocked("reconciliation_required")).toBe(true)
    expect(isExecutionRetryBlocked("prepared")).toBe(false)
    expect(isExecutionRetryBlocked("confirmed")).toBe(false)
  })

  it("idempotent execute returns early for in-flight or terminal broadcast states", () => {
    for (const status of [
      "executing",
      "submitted",
      "unknown",
      "confirmed",
      "executed",
      "reconciliation_required",
    ]) {
      expect(isIdempotentExecutionReturn(status)).toBe(true)
    }
    expect(isIdempotentExecutionReturn("prepared")).toBe(false)
    expect(isIdempotentExecutionReturn("failed")).toBe(false)
  })

  it("reconciler selects submitted/unknown/reconciliation_required rows with tx hash only", () => {
    expect(isReconcileCandidate("submitted", "0x1")).toBe(true)
    expect(isReconcileCandidate("unknown", "0x1")).toBe(true)
    expect(isReconcileCandidate("reconciliation_required", "0x1")).toBe(true)
    expect(isReconcileCandidate("submitted", null)).toBe(false)
    expect(isReconcileCandidate("prepared", "0x1")).toBe(false)
    expect(isReconcileCandidate("failed", "0x1")).toBe(false)
  })

  it("commits guard only after confirmed settlement", () => {
    const confirmed = transitionAfterSettlementVerification("CONFIRMED", "auth-1")
    expect(confirmed.shouldCommitGuard).toBe(true)
    expect(confirmed.shouldReleaseGuard).toBe(false)
    expect(confirmed.guardStatus).toBe("committed")
  })

  it("keeps guard frozen for reconciliation_required settlement", () => {
    const mismatch = transitionAfterSettlementVerification("RECONCILIATION_REQUIRED", "auth-1")
    expect(mismatch.shouldCommitGuard).toBe(false)
    expect(mismatch.shouldReleaseGuard).toBe(false)
    expect(mismatch.guardStatus).toBe("frozen")
    expect(mismatch.paymentStatus).toBe("reconciliation_required")
  })

  it("releases guard on reverted settlement", () => {
    const reverted = transitionAfterSettlementVerification("REVERTED", "auth-1")
    expect(reverted.shouldReleaseGuard).toBe(true)
    expect(reverted.guardStatus).toBe("released")
  })

  it("builds durable payment identifiers", () => {
    expect(buildPaymentIdentifier("pi_1", "idem_1")).toBe("pi_1:idem_1")
  })

  it("uses reserved then frozen guard lifecycle labels", () => {
    expect(guardStatusAfterReserve()).toBe("reserved")
    expect(guardStatusAfterBroadcast()).toBe("frozen")
  })
})
