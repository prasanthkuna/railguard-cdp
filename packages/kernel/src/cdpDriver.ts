import { randomUUID } from "node:crypto"
import { createHash } from "node:crypto"
import {
  type CanonicalCdpTransferRequest,
  buildCanonicalCdpTransferRequest,
  hashCanonicalCdpRequest,
  verifyCanonicalCdpRequest,
} from "../../cdp/src"

export type ExecutionAttemptStatus =
  | "SUBMITTING"
  | "SUBMITTED"
  | "UNKNOWN"
  | "REJECTED_BEFORE_BROADCAST"

export type BroadcastResult =
  | "BROADCAST_CONFIRMED"
  | "BROADCAST_UNKNOWN"
  | "REJECTED_BEFORE_BROADCAST"

export interface ExecutionAttemptRecord {
  id: string
  organizationId: string
  paymentIntentId: string
  executionId: string
  provider: string
  providerIdempotencyKey: string
  canonicalRequest: CanonicalCdpTransferRequest
  requestHash: string
  status: ExecutionAttemptStatus
  txHash?: string | null
  providerOperationId?: string | null
  responseHash?: string | null
}

export function prepareExecutionAttempt(input: {
  organizationId: string
  paymentIntentId: string
  executionId: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
  existing?: ExecutionAttemptRecord | null
}): ExecutionAttemptRecord {
  const canonicalRequest = buildCanonicalCdpTransferRequest({
    organizationId: input.organizationId,
    paymentIntentId: input.paymentIntentId,
    recipientAddress: input.recipientAddress,
    amountBaseUnits: input.amountBaseUnits,
    chain: input.chain,
  })
  const requestHash = hashCanonicalCdpRequest(canonicalRequest)

  if (input.existing) {
    if (
      !verifyCanonicalCdpRequest(
        input.existing.canonicalRequest,
        input.existing.requestHash,
        canonicalRequest,
      )
    ) {
      throw new Error("execution attempt request hash mismatch")
    }
    if (input.existing.executionId !== input.executionId) {
      throw new Error("execution attempt execution_id mismatch")
    }
    return input.existing
  }

  return {
    id: `exa_${randomUUID()}`,
    organizationId: input.organizationId,
    paymentIntentId: input.paymentIntentId,
    executionId: input.executionId,
    provider: "cdp",
    providerIdempotencyKey: randomUUID(),
    canonicalRequest,
    requestHash,
    status: "SUBMITTING",
  }
}

export function classifyBroadcastResult(input: {
  txHash?: string
  error?: unknown
  dropResponse?: boolean
}): BroadcastResult {
  if (input.dropResponse) {
    return "BROADCAST_UNKNOWN"
  }
  if (input.txHash) {
    return "BROADCAST_CONFIRMED"
  }
  return "REJECTED_BEFORE_BROADCAST"
}

export function executionAttemptStatusAfterBroadcast(
  result: BroadcastResult,
): ExecutionAttemptStatus {
  switch (result) {
    case "BROADCAST_CONFIRMED":
      return "SUBMITTED"
    case "BROADCAST_UNKNOWN":
      return "UNKNOWN"
    default:
      return "REJECTED_BEFORE_BROADCAST"
  }
}

export function hashProviderResponse(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export function shouldRecoverExecutionAttempt(
  attempt: ExecutionAttemptRecord | null | undefined,
): boolean {
  return attempt?.status === "SUBMITTING" || attempt?.status === "UNKNOWN"
}

export function blocksDuplicateExecutionAttempt(
  attempt: ExecutionAttemptRecord | null | undefined,
  executionId: string,
): boolean {
  if (!attempt) return false
  if (attempt.executionId !== executionId) return true
  return attempt.status === "SUBMITTED"
}
