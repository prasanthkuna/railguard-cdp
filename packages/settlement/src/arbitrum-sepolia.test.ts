import { describe, expect, it } from "bun:test"
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "./arbitrum-sepolia"
import { parseErc20TransferLogs, verifyTransferFacts } from "./index"
import { ERC20_TRANSFER_TOPIC } from "./index"

const TOKEN = "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d"
const SENDER = "0x1111111111111111111111111111111111111111"
const RECIPIENT = "0x2222222222222222222222222222222222222222"

describe("arbitrum sepolia settlement facts", () => {
  it("verifies transfer on chain 421614", () => {
    const from = SENDER.toLowerCase().replace("0x", "").padStart(64, "0")
    const to = RECIPIENT.toLowerCase().replace("0x", "").padStart(64, "0")
    const amount = 1_000_000n.toString(16).padStart(64, "0")
    const transfers = parseErc20TransferLogs([
      {
        address: TOKEN,
        topics: [ERC20_TRANSFER_TOPIC, `0x${from}`, `0x${to}`],
        data: `0x${amount}`,
      },
    ])
    const result = verifyTransferFacts({
      receiptStatus: "success",
      confirmations: 3,
      requiredConfirmations: 1,
      observedChainId: ARBITRUM_SEPOLIA_CHAIN_ID,
      transfers,
      expected: {
        chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
        tokenAddress: TOKEN,
        sender: SENDER,
        recipient: RECIPIENT,
        amount: 1_000_000n,
      },
    })
    expect(result.status).toBe("CONFIRMED")
  })
})
