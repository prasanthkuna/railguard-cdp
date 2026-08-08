import { type CanonicalCdpTransferRequest } from "../../packages/cdp/src/cdpRequest"
import {
  type ExecutionAttemptRecord,
  type ExecutionAttemptStatus,
  prepareExecutionAttempt,
} from "./cdpExecutionDriver"
import { db } from "./db"

interface ExecutionAttemptRow {
  id: string
  organization_id: string
  payment_intent_id: string
  execution_id: string
  provider: string
  provider_idempotency_key: string
  canonical_request_json: CanonicalCdpTransferRequest
  request_hash: string
  status: ExecutionAttemptStatus
  tx_hash: string | null
  provider_operation_id: string | null
  response_hash: string | null
}

function mapExecutionAttempt(row: ExecutionAttemptRow): ExecutionAttemptRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    paymentIntentId: row.payment_intent_id,
    executionId: row.execution_id,
    provider: row.provider,
    providerIdempotencyKey: row.provider_idempotency_key,
    canonicalRequest: row.canonical_request_json,
    requestHash: row.request_hash,
    status: row.status,
    txHash: row.tx_hash,
    providerOperationId: row.provider_operation_id,
    responseHash: row.response_hash,
  }
}

export async function findExecutionAttemptByExecutionId(
  organizationId: string,
  executionId: string,
): Promise<ExecutionAttemptRecord | null> {
  const row = await db.queryRow<ExecutionAttemptRow>`
    SELECT *
    FROM execution_attempts
    WHERE organization_id = ${organizationId}
      AND execution_id = ${executionId}
  `
  return row ? mapExecutionAttempt(row) : null
}

export async function findExecutionAttemptByPaymentIntent(
  organizationId: string,
  paymentIntentId: string,
): Promise<ExecutionAttemptRecord | null> {
  const row = await db.queryRow<ExecutionAttemptRow>`
    SELECT *
    FROM execution_attempts
    WHERE organization_id = ${organizationId}
      AND payment_intent_id = ${paymentIntentId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return row ? mapExecutionAttempt(row) : null
}

export async function persistExecutionAttempt(
  attempt: ExecutionAttemptRecord,
): Promise<ExecutionAttemptRecord> {
  await db.exec`
    INSERT INTO execution_attempts (
      id,
      organization_id,
      payment_intent_id,
      execution_id,
      provider,
      provider_idempotency_key,
      canonical_request_json,
      request_hash,
      status
    )
    VALUES (
      ${attempt.id},
      ${attempt.organizationId},
      ${attempt.paymentIntentId},
      ${attempt.executionId},
      ${attempt.provider},
      ${attempt.providerIdempotencyKey},
      ${JSON.stringify(attempt.canonicalRequest)},
      ${attempt.requestHash},
      ${attempt.status}
    )
    ON CONFLICT (execution_id) DO NOTHING
  `
  const stored = await findExecutionAttemptByExecutionId(attempt.organizationId, attempt.executionId)
  if (!stored) {
    throw new Error("failed to persist execution attempt")
  }
  return stored
}

export async function getOrCreateExecutionAttempt(input: {
  organizationId: string
  paymentIntentId: string
  executionId: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
}): Promise<ExecutionAttemptRecord> {
  const existing = await findExecutionAttemptByExecutionId(input.organizationId, input.executionId)
  const attempt = prepareExecutionAttempt({ ...input, existing })
  if (existing) {
    return attempt
  }
  return persistExecutionAttempt(attempt)
}

export async function updateExecutionAttemptAfterBroadcast(input: {
  organizationId: string
  executionId: string
  status: ExecutionAttemptStatus
  txHash?: string
  providerOperationId?: string
  responseHash?: string
  responseJson?: Record<string, unknown>
}): Promise<void> {
  await db.exec`
    UPDATE execution_attempts
    SET
      status = ${input.status},
      tx_hash = ${input.txHash ?? null},
      provider_operation_id = ${input.providerOperationId ?? null},
      response_hash = ${input.responseHash ?? null},
      response_json = ${input.responseJson ? JSON.stringify(input.responseJson) : null},
      updated_at = NOW()
    WHERE organization_id = ${input.organizationId}
      AND execution_id = ${input.executionId}
  `
}

export function createDbExecutionAttemptStore(): import("./executionAttemptStore").ExecutionAttemptStore {
  return {
    getOrCreate: getOrCreateExecutionAttempt,
    updateAfterBroadcast: updateExecutionAttemptAfterBroadcast,
  }
}
