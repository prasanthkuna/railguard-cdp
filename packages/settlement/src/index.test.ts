import { describe, expect, it } from "bun:test"
import {
  ERC20_TRANSFER_TOPIC,
  parseErc20TransferLogs,
  transferMatchesExpected,
  verifyDemoSettlement,
  verifyTransferFacts,
} from "./index"

const TOKEN = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
const SENDER = "0x1111111111111111111111111111111111111111"
const RECIPIENT = "0x2222222222222222222222222222222222222222"

function transferLog(input: {
  token?: string
  from?: string
  to?: string
  amount?: bigint
}) {
  const from = (input.from ?? SENDER).toLowerCase().replace("0x", "").padStart(64, "0")
  const to = (input.to ?? RECIPIENT).toLowerCase().replace("0x", "").padStart(64, "0")
  const amount = (input.amount ?? 1_000_000n).toString(16).padStart(64, "0")
  return {
    address: input.token ?? TOKEN,
    topics: [ERC20_TRANSFER_TOPIC, `0x${from}`, `0x${to}`],
    data: `0x${amount}`,
  }
}

describe("settlement fact verification", () => {
  it("confirms when transfer facts match", () => {
    const transfers = parseErc20TransferLogs([transferLog({ amount: 1_000_000n })])
    const result = verifyTransferFacts({
      receiptStatus: "success",
      confirmations: 2,
      requiredConfirmations: 1,
      observedChainId: 84532,
      transfers,
      expected: {
        chainId: 84532,
        tokenAddress: TOKEN,
        sender: SENDER,
        recipient: RECIPIENT,
        amount: 1_000_000n,
      },
    })
    expect(result.status).toBe("CONFIRMED")
  })

  it("requires reconciliation for wrong recipient", () => {
    const transfers = parseErc20TransferLogs([
      transferLog({ to: "0x3333333333333333333333333333333333333333" }),
    ])
    const result = verifyTransferFacts({
      receiptStatus: "success",
      confirmations: 2,
      requiredConfirmations: 1,
      transfers,
      expected: {
        chainId: 84532,
        tokenAddress: TOKEN,
        sender: SENDER,
        recipient: RECIPIENT,
        amount: 1_000_000n,
      },
    })
    expect(result.status).toBe("RECONCILIATION_REQUIRED")
    expect(result.reason).toBe("transfer_facts_mismatch")
  })

  it("requires reconciliation for wrong amount", () => {
    const transfers = parseErc20TransferLogs([transferLog({ amount: 2_000_000n })])
    const result = verifyTransferFacts({
      receiptStatus: "success",
      confirmations: 2,
      requiredConfirmations: 1,
      transfers,
      expected: {
        chainId: 84532,
        tokenAddress: TOKEN,
        sender: SENDER,
        recipient: RECIPIENT,
        amount: 1_000_000n,
      },
    })
    expect(result.status).toBe("RECONCILIATION_REQUIRED")
  })

  it("returns reverted for failed receipt", () => {
    const result = verifyTransferFacts({
      receiptStatus: "reverted",
      confirmations: 1,
      requiredConfirmations: 1,
      transfers: [],
      expected: {
        chainId: 84532,
        tokenAddress: TOKEN,
        sender: SENDER,
        recipient: RECIPIENT,
        amount: 1_000_000n,
      },
    })
    expect(result.status).toBe("REVERTED")
  })

  it("matches transfers case-insensitively", () => {
    const transfers = parseErc20TransferLogs([transferLog({ amount: 1_000_000n })])
    expect(
      transferMatchesExpected(transfers[0]!, {
        chainId: 84532,
        tokenAddress: TOKEN.toUpperCase(),
        sender: SENDER.toUpperCase(),
        recipient: RECIPIENT.toUpperCase(),
        amount: 1_000_000n,
      }),
    ).toBe(true)
  })

  it("verifies demo hash binding", () => {
    expect(verifyDemoSettlement("0xabc", "0xabc").status).toBe("CONFIRMED")
    expect(verifyDemoSettlement("0xabc", "0xdef").status).toBe("RECONCILIATION_REQUIRED")
  })
})
