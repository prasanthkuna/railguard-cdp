import { describe, expect, it } from "bun:test"
import { buildDemoTransactionHash } from "../../packages/cdp/src"
import { verifyDemoSettlement } from "../../packages/settlement/src"
import {
  buildDemoExecutionSeed,
  buildExecutionCorrelation,
  executionFailureTransition,
} from "./paymentCorrelation"
import { transitionAfterSettlementVerification } from "./paymentReconciliation"

describe("payment lifecycle adversarial profiles", () => {
  it("APF-003 crash after broadcast keeps guard frozen", () => {
    const transition = executionFailureTransition("0xdeadbeef", "auth-123")
    expect(transition.paymentStatus).toBe("unknown")
    expect(transition.releaseGuard).toBe(false)
    expect(transition.guardStatus).toBe("frozen")
  })

  it("APF-003 crash before broadcast releases guard", () => {
    const transition = executionFailureTransition(undefined, "auth-123")
    expect(transition.paymentStatus).toBe("failed")
    expect(transition.releaseGuard).toBe(true)
    expect(transition.guardStatus).toBe("released")
  })

  it("APF-004 wrong transfer requires reconciliation and frozen guard", () => {
    const transition = transitionAfterSettlementVerification("RECONCILIATION_REQUIRED", "auth-123")
    expect(transition.paymentStatus).toBe("reconciliation_required")
    expect(transition.shouldCommitGuard).toBe(false)
    expect(transition.guardStatus).toBe("frozen")
  })

  it("late confirmation commits guard exactly once", () => {
    const first = transitionAfterSettlementVerification("CONFIRMED", "auth-123")
    const second = transitionAfterSettlementVerification("CONFIRMED", "auth-123", true)
    expect(first.shouldCommitGuard).toBe(true)
    expect(second.shouldCommitGuard).toBe(false)
  })

  it("process restart can rebuild correlation facts from durable fields", () => {
    const correlation = buildExecutionCorrelation({
      paymentIntentId: "pi_123",
      executionIdempotencyKey: "exec-key",
      organizationID: "org_1",
      payerAddress: "0x1111111111111111111111111111111111111111",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      guardAuthorizationId: "auth-1",
      guardReceiptId: "rcpt-1",
      guardFingerprint: "fp-1",
    })
    expect(correlation.paymentIdentifier).toBe("pi_123:exec-key")
    expect(correlation.guardAuthorizationId).toBe("auth-1")
    expect(correlation.expectedAmount).toBe("1000000")
  })

  it("demo settlement binds tx hash to execution seed", () => {
    const seed = buildDemoExecutionSeed({
      organizationID: "org_1",
      paymentIntentId: "pi_1",
      idempotencyKey: "idem_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
    })
    const txHash = buildDemoTransactionHash(seed)
    expect(verifyDemoSettlement(txHash, txHash).status).toBe("CONFIRMED")
    expect(verifyDemoSettlement("0xwrong", txHash).status).toBe("RECONCILIATION_REQUIRED")
  })
})
