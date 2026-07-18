import { BASE_SEPOLIA_CHAIN_ID } from "../../packages/cdp/src"
import type { SettlementVerificationResult } from "../../packages/settlement/src"
import type { ExecutionCorrelation } from "./paymentCorrelation"
import { verifySettlement } from "./providers"
import {
  commitPaymentGuardAuthorization,
  organizationAgentId,
  recordPaymentSettlement,
  releasePaymentGuardAuthorization,
} from "./x402Guard"

export async function verifyExecutionSettlement(input: {
  txHash: string
  chain: string
  correlation: ExecutionCorrelation
  demoSeed: string
}): Promise<SettlementVerificationResult> {
  return verifySettlement({
    txHash: input.txHash,
    demoSeed: input.demoSeed,
    expected:
      input.chain === "base-sepolia"
        ? {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            tokenAddress: input.correlation.expectedToken,
            sender: input.correlation.expectedSender,
            recipient: input.correlation.expectedRecipient,
            amount: BigInt(input.correlation.expectedAmount),
          }
        : undefined,
  })
}

export async function commitGuardAfterSettlement(input: {
  organizationID: string
  correlation: ExecutionCorrelation
}): Promise<void> {
  if (!input.correlation.guardAuthorizationId) return
  await commitPaymentGuardAuthorization({
    organizationID: input.organizationID,
    authorizationId: input.correlation.guardAuthorizationId,
    agentId: organizationAgentId(input.organizationID),
    amountBaseUnits: input.correlation.expectedAmount,
  })
}

export async function releaseGuardIfPresent(input: {
  organizationID: string
  guardAuthorizationId?: string
}): Promise<void> {
  if (!input.guardAuthorizationId) return
  await releasePaymentGuardAuthorization(input.organizationID, input.guardAuthorizationId)
}

export function recordGuardSettlement(
  organizationID: string,
  receiptId: string | undefined,
  txHash: string,
) {
  if (!receiptId) return undefined
  return recordPaymentSettlement(organizationID, receiptId, txHash)
}
