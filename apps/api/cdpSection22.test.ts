import { describe, expect, it } from "bun:test"
import { submitPersistedCdpTransferCore } from "./cdpRecoveryScenario"
import { getCdpTransferHook, setCdpTransferHookForTests } from "./cdpTransferHook"
import { InMemoryExecutionAttemptStore } from "./executionAttemptStore"
import type { CdpTransferExecutor } from "./cdpRecoveryScenario"

const executeViaHook: CdpTransferExecutor = async (input) => {
  const hook = getCdpTransferHook()
  if (!hook) {
    throw new Error("CDP transfer hook not configured")
  }
  const result = await hook(input)
  if (result === "DROP_RESPONSE") {
    throw new Error("CDP_RESPONSE_DROPPED")
  }
  return result
}

describe("v4 §22 CDP response-drop recovery", () => {
  it("retries with the same provider idempotency key after a dropped response", async () => {
    const store = new InMemoryExecutionAttemptStore()
    let providerCalls = 0
    const expectedTxHash = "0xsection22deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

    setCdpTransferHookForTests(async (input) => {
      providerCalls += 1
      if (providerCalls === 1) {
        expect(input.providerIdempotencyKey).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
        return "DROP_RESPONSE"
      }
      expect(input.providerIdempotencyKey).toBe(
        store.getAttempt("org_section22", "exec_section22")?.providerIdempotencyKey,
      )
      return { txHash: expectedTxHash, mode: "demo" }
    })

    const submitInput = {
      organizationId: "org_section22",
      paymentIntentId: "pi_section22",
      executionId: "exec_section22",
      recipientAddress: "0x2222222222222222222222222222222222222222",
      amountBaseUnits: "1000000",
      chain: "base-sepolia",
      idempotencyKey: "exec-idem-section22",
    }

    try {
      await expect(
        submitPersistedCdpTransferCore(submitInput, {
          store,
          executeTransfer: executeViaHook,
        }),
      ).rejects.toThrow("CDP_RESPONSE_DROPPED")

      const afterDrop = store.getAttempt("org_section22", "exec_section22")
      expect(afterDrop?.status).toBe("UNKNOWN")
      expect(store.size()).toBe(1)

      const recovered = await submitPersistedCdpTransferCore(submitInput, {
        store,
        executeTransfer: executeViaHook,
      })
      expect(recovered.execution.txHash).toBe(expectedTxHash)
      expect(recovered.broadcastResult).toBe("BROADCAST_CONFIRMED")
      expect(providerCalls).toBe(2)

      const afterRecovery = store.getAttempt("org_section22", "exec_section22")
      expect(afterRecovery?.status).toBe("SUBMITTED")
      expect(afterRecovery?.providerIdempotencyKey).toBe(afterDrop?.providerIdempotencyKey)
      expect(store.size()).toBe(1)
    } finally {
      setCdpTransferHookForTests(null)
    }
  })
})
