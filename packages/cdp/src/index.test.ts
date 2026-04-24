import { describe, expect, test } from "bun:test"
import {
  BASE_SEPOLIA_CHAIN,
  BASE_SEPOLIA_USDC,
  buildDemoPaymentPayload,
  buildDemoTransactionHash,
} from "./index"

describe("cdp helpers", () => {
  test("builds a base sepolia usdc payload", () => {
    const payload = buildDemoPaymentPayload({
      invoiceID: "inv_1",
      recipientAddress: "0x1111111111111111111111111111111111111111",
      amountBaseUnits: "1000000",
    })

    expect(payload.chain).toBe(BASE_SEPOLIA_CHAIN)
    expect(payload.tokenAddress).toBe(BASE_SEPOLIA_USDC)
  })

  test("creates deterministic demo transaction hashes", () => {
    const hash = buildDemoTransactionHash("payment-intent:idempotency")
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
    expect(hash).toBe(buildDemoTransactionHash("payment-intent:idempotency"))
  })
})
