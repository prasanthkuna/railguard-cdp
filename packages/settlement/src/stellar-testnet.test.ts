import { describe, expect, test } from "bun:test"
import { STELLAR_TESTNET_EVIDENCE_TX, verifyStellarTestnetPayment } from "./stellar-testnet"

const RUN_LIVE = process.env.TESTNET_INTEGRATION === "1"

describe("Stellar testnet (Horizon)", () => {
  test.skipIf(!RUN_LIVE)("verifies grant evidence payment on testnet", async () => {
    const result = await verifyStellarTestnetPayment({
      txHash: STELLAR_TESTNET_EVIDENCE_TX,
      expectedDestination: "GB2VOBJNNP4ZC3LNJBDJ6CMD3PC2FJFI24MOCE4W6LDMVPSCMYYN6NIG",
      expectedAmount: "1.0000000",
      expectedMemo: "PI:pi-testnet-evidence",
    })
    expect(result.status).toBe("CONFIRMED")
  })
})
