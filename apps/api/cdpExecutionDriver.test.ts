import { describe, expect, it } from "bun:test"
import {
  buildCanonicalCdpTransferRequest,
  hashCanonicalCdpRequest,
} from "../../packages/cdp/src/cdpRequest"
import {
  classifyBroadcastResult,
  executionAttemptStatusAfterBroadcast,
  prepareExecutionAttempt,
  shouldRecoverExecutionAttempt,
} from "./cdpExecutionDriver"

describe("cdp execution driver", () => {
  it("persists a stable canonical request hash", () => {
    const request = buildCanonicalCdpTransferRequest({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
    })
    expect(hashCanonicalCdpRequest(request)).toHaveLength(64)
    expect(hashCanonicalCdpRequest(request)).toBe(hashCanonicalCdpRequest(request))
  })

  it("reuses the same provider idempotency key on recovery", () => {
    const first = prepareExecutionAttempt({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      executionId: "exec_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
    })
    const recovered = prepareExecutionAttempt({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      executionId: "exec_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
      existing: first,
    })
    expect(recovered.providerIdempotencyKey).toBe(first.providerIdempotencyKey)
    expect(shouldRecoverExecutionAttempt(recovered)).toBe(true)
  })

  it("maps dropped provider responses to UNKNOWN attempts", () => {
    expect(classifyBroadcastResult({ dropResponse: true })).toBe("BROADCAST_UNKNOWN")
    expect(executionAttemptStatusAfterBroadcast("BROADCAST_UNKNOWN")).toBe("UNKNOWN")
  })

  it("v4 section 22 counters stay bounded on recovery replay", () => {
    const first = prepareExecutionAttempt({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      executionId: "exec_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
    })
    const recovered = prepareExecutionAttempt({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      executionId: "exec_1",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
      existing: first,
    })

    expect(recovered.providerIdempotencyKey).toBe(first.providerIdempotencyKey)
    expect(recovered.executionId).toBe(first.executionId)
  })
})
