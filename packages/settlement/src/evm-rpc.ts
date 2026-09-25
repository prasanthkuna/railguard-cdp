/** Shared viem RPC settlement fetch for any EVM chain. */

import { http, type Chain, type Hash, createPublicClient } from "viem"
import {
  type ExpectedTransferFacts,
  type SettlementVerificationResult,
  parseErc20TransferLogs,
  verifyTransferFacts,
} from "./index.js"

export function createEvmPublicClient(chain: Chain, rpcUrl?: string) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? chain.rpcUrls.default.http[0]),
  })
}

async function withRpcFallback<T>(
  chain: Chain,
  urls: readonly string[],
  fn: (rpcUrl: string) => Promise<T>,
): Promise<T> {
  let lastError: unknown
  for (const url of urls) {
    try {
      return await fn(url)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchSettlementFromTx(input: {
  chain: Chain
  chainId: number
  txHash: string
  expected?: ExpectedTransferFacts
  requiredConfirmations?: number
  rpcUrl?: string
  rpcUrls?: readonly string[]
}): Promise<SettlementVerificationResult & { txHash: string; confirmations: number }> {
  const urls =
    input.rpcUrls ?? (input.rpcUrl ? [input.rpcUrl] : input.chain.rpcUrls.default.http)
  return withRpcFallback(input.chain, urls, async (rpcUrl) => {
    const client = createEvmPublicClient(input.chain, rpcUrl)
    const requiredConfirmations = input.requiredConfirmations ?? 1

    const receipt = await client.getTransactionReceipt({
    hash: input.txHash as Hash,
  })
  const blockNumber = await client.getBlockNumber()
  const confirmations = Number(blockNumber - receipt.blockNumber) + 1

  const transfers = parseErc20TransferLogs(
    receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics as readonly string[],
      data: log.data,
    })),
  )

  if (!input.expected) {
    if (receipt.status !== "success") {
      return {
        status: "REVERTED",
        reason: "transaction_reverted",
        txHash: input.txHash,
        confirmations,
      }
    }
    return { status: "CONFIRMED", txHash: input.txHash, confirmations }
  }

  const result = verifyTransferFacts({
    receiptStatus: receipt.status,
    confirmations,
    requiredConfirmations,
    observedChainId: input.chainId,
    transfers,
    expected: input.expected,
  })

    return { ...result, txHash: input.txHash, confirmations }
  })
}

export function buildExpectedFromTransfer(
  chainId: number,
  transfer: ReturnType<typeof parseErc20TransferLogs>[number],
): ExpectedTransferFacts {
  return {
    chainId,
    tokenAddress: transfer.tokenAddress,
    sender: transfer.from,
    recipient: transfer.to,
    amount: transfer.amount,
  }
}
