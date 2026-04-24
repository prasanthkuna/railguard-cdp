import { describe, expect, test } from "bun:test"
import { evaluateInvoicePolicy } from "./index"

describe("evaluateInvoicePolicy", () => {
  test("allows a known approved vendor wallet under threshold", () => {
    const result = evaluateInvoicePolicy({
      vendorStatus: "approved",
      vendorRiskScore: 10,
      approvedWallets: [
        {
          chain: "base-sepolia",
          address: "0x1111111111111111111111111111111111111111",
          status: "approved",
        },
      ],
      invoiceNumber: "INV-100",
      invoiceHash: "hash",
      amountBaseUnits: "1000000",
      token: "USDC",
      chain: "base-sepolia",
      walletAddress: "0x1111111111111111111111111111111111111111",
      extractionConfidence: 0.98,
      supportedToken: "usdc",
      supportedChain: "base-sepolia",
      reviewThresholdBaseUnits: 5000000000n,
      hardCapBaseUnits: 100000000000n,
    })

    expect(result.result).toBe("allow")
    expect(result.triggeredRules).toEqual([])
  })

  test("blocks duplicate invoice with wallet change", () => {
    const result = evaluateInvoicePolicy({
      vendorStatus: "approved",
      vendorRiskScore: 10,
      approvedWallets: [
        {
          chain: "base-sepolia",
          address: "0x1111111111111111111111111111111111111111",
          status: "approved",
        },
      ],
      invoiceNumber: "INV-101",
      invoiceHash: "hash",
      duplicateInvoiceID: "inv_existing",
      amountBaseUnits: "1000000",
      token: "usdc",
      chain: "base-sepolia",
      walletAddress: "0x2222222222222222222222222222222222222222",
      extractionConfidence: 0.99,
      supportedToken: "usdc",
      supportedChain: "base-sepolia",
      reviewThresholdBaseUnits: 5000000000n,
      hardCapBaseUnits: 100000000000n,
    })

    expect(result.result).toBe("block")
    expect(result.triggeredRules).toContain("invoice.duplicate")
    expect(result.triggeredRules).toContain("wallet.changed")
  })

  test("escalates pending vendors and large invoices", () => {
    const result = evaluateInvoicePolicy({
      vendorStatus: "pending",
      vendorRiskScore: 10,
      approvedWallets: [
        {
          chain: "base-sepolia",
          address: "0x1111111111111111111111111111111111111111",
          status: "approved",
        },
      ],
      invoiceHash: "hash",
      amountBaseUnits: "6000000000",
      token: "usdc",
      chain: "base-sepolia",
      walletAddress: "0x1111111111111111111111111111111111111111",
      extractionConfidence: 0.79,
      supportedToken: "usdc",
      supportedChain: "base-sepolia",
      reviewThresholdBaseUnits: 5000000000n,
      hardCapBaseUnits: 100000000000n,
    })

    expect(result.result).toBe("escalate")
    expect(result.triggeredRules).toContain("vendor.pending_onboarding")
    expect(result.triggeredRules).toContain("amount.requires_review")
    expect(result.triggeredRules).toContain("invoice.low_extraction_confidence")
  })
})
