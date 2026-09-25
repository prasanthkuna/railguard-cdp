/** Base Sepolia live RPC settlement verification — no mocks. */

import type { Hash } from "viem"
import { baseSepolia } from "viem/chains"
import {
  buildExpectedFromTransfer as buildExpectedForChain,
  createEvmPublicClient,
  fetchSettlementFromTx as fetchEvmSettlementFromTx,
} from "./evm-rpc.js"
import {
  type ExpectedTransferFacts,
  type SettlementVerificationResult,
  parseErc20TransferLogs,
} from "./index.js"

export const BASE_SEPOLIA_RPC = "https://sepolia.base.org"
export const BASE_SEPOLIA_CHAIN_ID = 84532
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

export function createBaseSepoliaClient(rpcUrl = BASE_SEPOLIA_RPC) {
  return createEvmPublicClient(baseSepolia, rpcUrl)
}

export async function fetchSettlementFromTx(input: {
  txHash: string
  expected?: ExpectedTransferFacts
  requiredConfirmations?: number
  rpcUrl?: string
}): Promise<SettlementVerificationResult & { txHash: string; confirmations: number }> {
  return fetchEvmSettlementFromTx({
    chain: baseSepolia,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    txHash: input.txHash,
    expected: input.expected,
    requiredConfirmations: input.requiredConfirmations,
    rpcUrl: input.rpcUrl,
  })
}

/** Discover a recent USDC transfer on Base Sepolia for read-only evidence (no keys). */
export async function discoverRecentUsdcTransfer(input?: {
  rpcUrl?: string
  lookbackBlocks?: number
  maxBlockRange?: number
}): Promise<{
  txHash: string
  transfer: ReturnType<typeof parseErc20TransferLogs>[number]
} | null> {
  const client = createBaseSepoliaClient(input?.rpcUrl)
  const maxRange = input?.maxBlockRange ?? 1000
  const lookback = input?.lookbackBlocks ?? 20_000
  const latest = await client.getBlockNumber()
  const start = latest > BigInt(lookback) ? latest - BigInt(lookback) : 0n

  for (let toBlock = latest; toBlock >= start; toBlock -= BigInt(maxRange)) {
    const fromBlock = toBlock > BigInt(maxRange) ? toBlock - BigInt(maxRange) + 1n : start
    if (fromBlock > toBlock) break

    const logs = await client.getLogs({
      address: BASE_SEPOLIA_USDC as `0x${string}`,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { indexed: true, name: "from", type: "address" },
          { indexed: true, name: "to", type: "address" },
          { indexed: false, name: "value", type: "uint256" },
        ],
      },
      fromBlock,
      toBlock,
    })

    if (logs.length === 0) continue

    const last = logs[logs.length - 1]
    if (!last) continue
    const transfers = parseErc20TransferLogs([
      {
        address: last.address,
        topics: last.topics as readonly string[],
        data: last.data,
      },
    ])
    const transfer = transfers[0]
    if (!transfer) continue

    return { txHash: last.transactionHash, transfer }
  }

  return null
}

export function buildExpectedFromTransfer(
  transfer: ReturnType<typeof parseErc20TransferLogs>[number],
): ExpectedTransferFacts {
  return buildExpectedForChain(BASE_SEPOLIA_CHAIN_ID, transfer)
}

export async function generateBaseSepoliaEvidence(input?: {
  txHash?: string
  rpcUrl?: string
}): Promise<{
  network: "base-sepolia"
  chainId: number
  rpcUrl: string
  txHash: string
  explorerUrl: string
  expected: ExpectedTransferFacts
  settlement: SettlementVerificationResult
  confirmations: number
  generatedAt: string
}> {
  const rpcUrl = input?.rpcUrl ?? BASE_SEPOLIA_RPC
  let txHash = input?.txHash

  if (!txHash) {
    const discovered = await discoverRecentUsdcTransfer({ rpcUrl })
    if (!discovered) {
      throw new Error("no recent USDC transfers found on Base Sepolia — set BASE_SEPOLIA_TX_HASH")
    }
    txHash = discovered.txHash
  }

  const client = createBaseSepoliaClient(rpcUrl)
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hash })
  const transfers = parseErc20TransferLogs(
    receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics as readonly string[],
      data: log.data,
    })),
  )
  const transfer = transfers.find(
    (t) => t.tokenAddress.toLowerCase() === BASE_SEPOLIA_USDC.toLowerCase(),
  )
  if (!transfer) {
    throw new Error(`no USDC transfer in tx ${txHash}`)
  }

  const expected = buildExpectedFromTransfer(transfer)
  const settlement = await fetchSettlementFromTx({
    txHash,
    expected,
    rpcUrl,
  })

  return {
    network: "base-sepolia",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    rpcUrl,
    txHash,
    explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    expected,
    settlement,
    confirmations: settlement.confirmations,
    generatedAt: new Date().toISOString(),
  }
}
