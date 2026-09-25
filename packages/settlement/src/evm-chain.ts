/** Generic EVM settlement verification for any registered chain. */

import type { Chain } from "viem"
import { defineChain } from "viem"
import type { Hash } from "viem"
import { getEvmChain } from "./chains.js"
import { buildExpectedFromTransfer, fetchSettlementFromTx } from "./evm-rpc.js"
import type { ExpectedTransferFacts, SettlementVerificationResult } from "./index.js"
import { parseErc20TransferLogs } from "./index.js"

function toViemChain(descriptor: ReturnType<typeof getEvmChain>): Chain {
  return defineChain({
    id: descriptor.chainId,
    name: descriptor.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [...descriptor.rpcUrls] } },
  })
}

export async function createPublicClientForEvmChain(chainId: string) {
  const descriptor = getEvmChain(chainId)
  const chain = toViemChain(descriptor)
  const { createEvmPublicClient } = await import("./evm-rpc.js")
  return createEvmPublicClient(chain, descriptor.rpcUrls[0])
}

export async function verifyEvmChainTx(input: {
  chainId: string
  txHash: string
  expected?: ExpectedTransferFacts
  requiredConfirmations?: number
}): Promise<SettlementVerificationResult & { txHash: string; confirmations: number }> {
  const descriptor = getEvmChain(input.chainId)
  const chain = toViemChain(descriptor)
  return fetchSettlementFromTx({
    chain,
    chainId: descriptor.chainId,
    txHash: input.txHash,
    expected: input.expected,
    requiredConfirmations: input.requiredConfirmations,
    rpcUrl: descriptor.rpcUrls[0],
  })
}

export async function buildExpectedUsdcFromTx(
  chainId: string,
  txHash: string,
): Promise<ExpectedTransferFacts> {
  const descriptor = getEvmChain(chainId)
  if (!descriptor.usdcAddress) {
    throw new Error(`no USDC address configured for ${chainId}`)
  }
  const chain = toViemChain(descriptor)
  const { createEvmPublicClient } = await import("./evm-rpc.js")
  const client = createEvmPublicClient(chain, descriptor.rpcUrls[0])
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hash })
  const transfers = parseErc20TransferLogs(
    receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics as readonly string[],
      data: log.data,
    })),
  )
  const transfer = transfers.find(
    (t) => t.tokenAddress.toLowerCase() === descriptor.usdcAddress?.toLowerCase(),
  )
  if (!transfer) throw new Error(`no USDC transfer in ${txHash} on ${chainId}`)
  return buildExpectedFromTransfer(descriptor.chainId, transfer)
}
