import type { ExpectedTransferFacts } from "@railguard/settlement"
/**
 * viem/ethers long-tail — wrap public client reads with settlement verification.
 */
import { verifyEvmChainTx } from "@railguard/settlement/evm-chain"

export async function guardedVerifyTransfer(input: {
  chainKey: string
  txHash: string
  expected: ExpectedTransferFacts
}) {
  return verifyEvmChainTx({
    chainId: input.chainKey,
    txHash: input.txHash,
    expected: input.expected,
  })
}
