/** Pure settlement-fact verification — no RPC dependencies. */

export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as const

export type SettlementVerificationStatus =
  | "CONFIRMED"
  | "REVERTED"
  | "RECONCILIATION_REQUIRED"
  | "PENDING"

export interface TransferLog {
  address: string
  topics: readonly string[]
  data: string
}

export interface ParsedTransfer {
  tokenAddress: string
  from: string
  to: string
  amount: bigint
}

export interface ExpectedTransferFacts {
  chainId: number
  tokenAddress: string
  sender: string
  recipient: string
  amount: bigint
}

export interface SettlementVerificationInput {
  receiptStatus: "success" | "reverted"
  confirmations: number
  requiredConfirmations: number
  observedChainId?: number
  transfers: ParsedTransfer[]
  expected: ExpectedTransferFacts
}

export interface SettlementVerificationResult {
  status: SettlementVerificationStatus
  matchedTransfer?: ParsedTransfer
  reason?: string
}

function normalizeAddress(value: string): string {
  return value.toLowerCase()
}

function topicToAddress(topic: string): string {
  const hex = topic.startsWith("0x") ? topic.slice(2) : topic
  return `0x${hex.slice(-40)}`.toLowerCase()
}

export function parseErc20TransferLogs(logs: readonly TransferLog[]): ParsedTransfer[] {
  const transfers: ParsedTransfer[] = []
  for (const log of logs) {
    if (log.topics.length < 3) continue
    if (normalizeAddress(log.topics[0] ?? "") !== ERC20_TRANSFER_TOPIC) continue
    const from = topicToAddress(log.topics[1] ?? "")
    const to = topicToAddress(log.topics[2] ?? "")
    const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data
    if (data.length < 64) continue
    transfers.push({
      tokenAddress: normalizeAddress(log.address),
      from,
      to,
      amount: BigInt(`0x${data.slice(-64)}`),
    })
  }
  return transfers
}

export function transferMatchesExpected(
  transfer: ParsedTransfer,
  expected: ExpectedTransferFacts,
): boolean {
  return (
    normalizeAddress(transfer.tokenAddress) === normalizeAddress(expected.tokenAddress) &&
    normalizeAddress(transfer.from) === normalizeAddress(expected.sender) &&
    normalizeAddress(transfer.to) === normalizeAddress(expected.recipient) &&
    transfer.amount === expected.amount
  )
}

export function verifyTransferFacts(
  input: SettlementVerificationInput,
): SettlementVerificationResult {
  if (input.receiptStatus === "reverted") {
    return { status: "REVERTED", reason: "transaction_reverted" }
  }

  if (input.observedChainId !== undefined && input.observedChainId !== input.expected.chainId) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "chain_id_mismatch",
    }
  }

  if (input.confirmations < input.requiredConfirmations) {
    return { status: "PENDING", reason: "insufficient_confirmations" }
  }

  const match = input.transfers.find((transfer) =>
    transferMatchesExpected(transfer, input.expected),
  )
  if (!match) {
    return {
      status: "RECONCILIATION_REQUIRED",
      reason: "transfer_facts_mismatch",
    }
  }

  return { status: "CONFIRMED", matchedTransfer: match }
}

/** Demo settlements are hash-bound, not chain-bound. */
export function verifyDemoSettlement(
  txHash: string,
  expectedTxHash: string,
): SettlementVerificationResult {
  if (txHash === expectedTxHash) {
    return { status: "CONFIRMED" }
  }
  return {
    status: "RECONCILIATION_REQUIRED",
    reason: "demo_tx_hash_mismatch",
  }
}
