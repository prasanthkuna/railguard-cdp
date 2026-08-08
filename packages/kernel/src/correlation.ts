import { BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_USDC } from "../../cdp/src"
import {
  buildPaymentIdentifier,
  buildPaymentResourceUrl,
  transitionAfterExecutionFailure,
  transitionAfterSettlementVerification,
} from "./reconciliation"
import { guardStatusAfterBroadcast, guardStatusAfterReserve } from "./lifecycle"

export interface ExecutionCorrelation {
  paymentIdentifier: string
  guardFingerprint?: string
  guardAuthorizationId?: string
  guardReceiptId?: string
  expectedChainId: string
  expectedToken: string
  expectedSender: string
  expectedRecipient: string
  expectedAmount: string
}

export interface PaymentGuardInputShape {
  organizationID: string
  payer: string
  payTo: string
  amountBaseUnits: string
  chain: string
  resourceUrl: string
  idempotencyKey: string
}

export function buildExecutionCorrelation(input: {
  paymentIntentId: string
  executionIdempotencyKey: string
  organizationID: string
  payerAddress: string
  recipientAddress: string
  amountBaseUnits: string
  tokenAddress: string
  guardFingerprint?: string
  guardAuthorizationId?: string
  guardReceiptId?: string
}): ExecutionCorrelation {
  return {
    paymentIdentifier: buildPaymentIdentifier(input.paymentIntentId, input.executionIdempotencyKey),
    guardFingerprint: input.guardFingerprint,
    guardAuthorizationId: input.guardAuthorizationId,
    guardReceiptId: input.guardReceiptId,
    expectedChainId: String(BASE_SEPOLIA_CHAIN_ID),
    expectedToken: input.tokenAddress || BASE_SEPOLIA_USDC,
    expectedSender: input.payerAddress,
    expectedRecipient: input.recipientAddress,
    expectedAmount: input.amountBaseUnits,
  }
}

export function buildDemoExecutionSeed(input: {
  organizationID: string
  paymentIntentId: string
  providerIdempotencyKey: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
}): string {
  return [
    input.organizationID,
    input.paymentIntentId,
    input.providerIdempotencyKey,
    input.recipientAddress,
    input.amountBaseUnits,
    input.chain,
  ].join(":")
}

export function buildGuardInput(
  organizationID: string,
  paymentIntentId: string,
  correlation: ExecutionCorrelation,
  executionIdempotencyKey: string,
): PaymentGuardInputShape {
  return {
    organizationID,
    payer: correlation.expectedSender,
    payTo: correlation.expectedRecipient,
    amountBaseUnits: correlation.expectedAmount,
    chain: "base-sepolia",
    resourceUrl: buildPaymentResourceUrl(paymentIntentId),
    idempotencyKey: executionIdempotencyKey,
  }
}

export function initialGuardStatus(correlation: ExecutionCorrelation): string | null {
  if (!correlation.guardAuthorizationId) return null
  return guardStatusAfterReserve()
}

export function frozenGuardStatus(): string {
  return guardStatusAfterBroadcast()
}

export function executionFailureTransition(
  broadcastedTxHash?: string,
  guardAuthorizationId?: string,
) {
  return transitionAfterExecutionFailure({ broadcastedTxHash, guardAuthorizationId })
}

export function settlementSuccessTransition(guardAuthorizationId?: string) {
  return transitionAfterSettlementVerification("CONFIRMED", guardAuthorizationId)
}
