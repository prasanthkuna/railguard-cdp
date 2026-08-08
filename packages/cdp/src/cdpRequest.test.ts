import { describe, expect, it } from "bun:test"
import {
  buildCanonicalCdpTransferRequest,
  hashCanonicalCdpRequest,
} from "./cdpRequest"

describe("canonical cdp request", () => {
  it("hashes deterministically", () => {
    const request = buildCanonicalCdpTransferRequest({
      organizationId: "org_1",
      paymentIntentId: "pi_1",
      recipientAddress: "0x1111111111111111111111111111111111111111",
      amountBaseUnits: "1000000",
    })
    expect(request.network).toBe("base-sepolia")
    expect(hashCanonicalCdpRequest(request)).toMatch(/^[a-f0-9]{64}$/)
  })
})
