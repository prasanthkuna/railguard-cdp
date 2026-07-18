import { describe, expect, it } from "vitest"
import { transitionAfterSettlementVerification } from "./paymentReconciliation"

describe("reconcile payment intent row (pure)", () => {
  it("commits guard on CONFIRMED settlement", () => {
    const t = transitionAfterSettlementVerification("CONFIRMED", "auth-1")
    expect(t.shouldCommitGuard).toBe(true)
    expect(t.shouldReleaseGuard).toBe(false)
    expect(t.guardStatus).toBe("committed")
  })

  it("keeps guard frozen on RECONCILIATION_REQUIRED", () => {
    const t = transitionAfterSettlementVerification("RECONCILIATION_REQUIRED", "auth-1")
    expect(t.shouldCommitGuard).toBe(false)
    expect(t.guardStatus).toBe("frozen")
  })

  it("idempotent commit when already committed", () => {
    const t = transitionAfterSettlementVerification("CONFIRMED", "auth-1", true)
    expect(t.shouldCommitGuard).toBe(false)
  })

  it("releases guard on REVERTED", () => {
    const t = transitionAfterSettlementVerification("REVERTED", "auth-1")
    expect(t.shouldReleaseGuard).toBe(true)
    expect(t.guardStatus).toBe("released")
  })
})
