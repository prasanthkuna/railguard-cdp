import { describe, expect, it } from "bun:test"
import { setCdpTransferHookForTests } from "./cdpTransferHook"
import {
  classifyBroadcastResult,
  executionAttemptStatusAfterBroadcast,
  prepareExecutionAttempt,
} from "./cdpExecutionDriver"

describe("cdp provider recovery hook", () => {
  it("classifies a dropped provider response as UNKNOWN before broadcast confirmation", () => {
    const result = classifyBroadcastResult({ dropResponse: true })
    expect(result).toBe("BROADCAST_UNKNOWN")
    expect(executionAttemptStatusAfterBroadcast(result)).toBe("UNKNOWN")
  })

  it("exposes a test hook for lost CDP responses", async () => {
    setCdpTransferHookForTests(async () => "DROP_RESPONSE")
    try {
      const attempt = prepareExecutionAttempt({
        organizationId: "org_1",
        paymentIntentId: "pi_1",
        executionId: "exec_1",
        recipientAddress: "0x2222222222222222222222222222222222222222",
        amountBaseUnits: "1000000",
        chain: "base-sepolia",
      })
      expect(attempt.providerIdempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    } finally {
      setCdpTransferHookForTests(null)
    }
  })
})
