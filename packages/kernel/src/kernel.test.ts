import { describe, expect, it } from "bun:test"
import { StubVaultExecutionDriver } from "./vaultDriver"

describe("@railguard/kernel", () => {
  it("exposes a stub vault driver for CDP_VAULT_CALL", async () => {
    const driver = new StubVaultExecutionDriver()
    const prepared = await driver.prepareVaultCall({
      executionId: "exec_1",
      intentHash: "0xabc",
      token: "0xtoken",
      recipient: "0xrecipient",
      amount: "1000000",
      expiry: 9999999999,
    })
    expect(prepared.provider).toBe("cdp_vault_call")
    const submitted = await driver.submitVaultCall("exec_1")
    expect(submitted.result).toBe("REJECTED_BEFORE_BROADCAST")
  })
})
