import { describe, expect, it } from "bun:test"
import {
  isExecutionRetryBlocked,
  isIdempotentExecutionReturn,
  isReconcileCandidate,
  terminalStatusAfterBroadcastFailure,
} from "./paymentState"

describe("payment state machine invariants", () => {
  it("post-broadcast failure becomes unknown, not failed", () => {
    expect(terminalStatusAfterBroadcastFailure("0xabc")).toBe("unknown")
    expect(terminalStatusAfterBroadcastFailure(undefined)).toBe("failed")
  })

  it("blocks retry while submitted or unknown", () => {
    expect(isExecutionRetryBlocked("submitted")).toBe(true)
    expect(isExecutionRetryBlocked("unknown")).toBe(true)
    expect(isExecutionRetryBlocked("prepared")).toBe(false)
    expect(isExecutionRetryBlocked("confirmed")).toBe(false)
  })

  it("idempotent execute returns early for in-flight or terminal broadcast states", () => {
    for (const status of ["executing", "submitted", "unknown", "confirmed", "executed"]) {
      expect(isIdempotentExecutionReturn(status)).toBe(true)
    }
    expect(isIdempotentExecutionReturn("prepared")).toBe(false)
    expect(isIdempotentExecutionReturn("failed")).toBe(false)
  })

  it("reconciler selects submitted/unknown rows with tx hash only", () => {
    expect(isReconcileCandidate("submitted", "0x1")).toBe(true)
    expect(isReconcileCandidate("unknown", "0x1")).toBe(true)
    expect(isReconcileCandidate("submitted", null)).toBe(false)
    expect(isReconcileCandidate("prepared", "0x1")).toBe(false)
    expect(isReconcileCandidate("failed", "0x1")).toBe(false)
  })
})
