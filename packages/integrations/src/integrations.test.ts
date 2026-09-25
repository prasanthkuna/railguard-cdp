import { describe, expect, it } from "bun:test"
import { describeAssuranceMode, resolveAssuranceMode } from "./assuranceMode"
import { INTEGRATION_PARTNERS } from "./rails"
import { createDefaultRiskPanel, worstRiskLevel } from "./risk"

describe("@railguard/integrations", () => {
  it("resolves assurance modes", () => {
    expect(describeAssuranceMode("GUARD").canBlockAuthorization).toBe(true)
    expect(describeAssuranceMode("OBSERVE").canBlockAuthorization).toBe(false)
  })

  it("lists partner integrations from plan §16", () => {
    expect(INTEGRATION_PARTNERS.wallets).toContain("privy")
    expect(INTEGRATION_PARTNERS.risk).toContain("blockaid")
    expect(INTEGRATION_PARTNERS.evmChains).toContain("arbitrum-sepolia")
  })

  it("risk panel returns UNKNOWN without keys", async () => {
    const results = await createDefaultRiskPanel()[0].evaluate({
      chainId: 421614,
      to: "0x0000000000000000000000000000000000000001",
      amount: "1",
    })
    expect(worstRiskLevel([results])).toBe("UNKNOWN")
  })

  it("default mode is GUARD", () => {
    const prev = process.env.RAILGUARD_ASSURANCE_MODE
    process.env.RAILGUARD_ASSURANCE_MODE = undefined
    expect(resolveAssuranceMode()).toBe("GUARD")
    if (prev) process.env.RAILGUARD_ASSURANCE_MODE = prev
  })
})
