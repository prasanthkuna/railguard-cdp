import { randomUUID } from "node:crypto"
import { APIError } from "encore.dev/api"
import { getAuthData } from "encore.dev/internal/codegen/auth"
import { type AppRole, type AuthenticatedActor, hasRequiredRole } from "../../packages/auth/src"
import {
  buildEvidenceEnvelope,
  explainCharge,
  type EvidenceEnvelope,
  hashEvidencePart,
} from "../../packages/kernel/src/evidence"
import {
  createFinancialIntent,
  type CreateFinancialIntentInput,
  type FinancialIntent,
} from "../../packages/kernel/src/intent"
import type { AuthorizationGrant } from "../../packages/kernel/src/authority"
import {
  mapLegacyPaymentStatus,
  type V5ExecutionStatus,
} from "../../packages/kernel/src/executionRail"
import { authorizeIntent } from "../../packages/kernel/src/v5Actions"
import { evaluatePaymentGuard, isX402GuardEnabled, organizationAgentId } from "./x402Guard"
import { buildGuardInput, buildExecutionCorrelation } from "./paymentCorrelation"
import { resolveCdpPayerAddress } from "./providers"
import { db } from "./db"

interface FinancialIntentRow {
  id: string
  organization_id: string
  payload_json: FinancialIntent
  status: V5ExecutionStatus
  idempotency_key: string
  payment_intent_id: string | null
  authorization_grant_json: AuthorizationGrant | null
  execution_id: string | null
  evidence_json: EvidenceEnvelope | null
  created_at: Date
  updated_at: Date
}

function v5Id(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function ensureIdempotencyKey(value: string): string {
  const normalized = value.trim()
  if (normalized.length < 8 || normalized.length > 128) {
    throw APIError.invalidArgument("idempotencyKey must be between 8 and 128 characters")
  }
  return normalized
}

export async function requireV5Actor(allowedRoles?: readonly AppRole[]): Promise<AuthenticatedActor> {
  const actor = getAuthData() as AuthenticatedActor | null
  if (!actor) throw APIError.unauthenticated("authentication required")
  if (!hasRequiredRole(actor, allowedRoles)) {
    throw APIError.permissionDenied("insufficient role")
  }
  return actor
}

function mapRow(row: FinancialIntentRow) {
  return {
    intent: row.payload_json,
    status: row.status,
    paymentIntentId: row.payment_intent_id ?? undefined,
    authorizationGrant: row.authorization_grant_json ?? undefined,
    executionId: row.execution_id ?? undefined,
    evidence: row.evidence_json ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function createStoredFinancialIntent(
  organizationId: string,
  input: CreateFinancialIntentInput,
): Promise<ReturnType<typeof mapRow>> {
  const idempotencyKey = ensureIdempotencyKey(input.idempotencyKey)
  const existing = await db.queryRow<FinancialIntentRow>`
    SELECT * FROM financial_intents
    WHERE organization_id = ${organizationId} AND idempotency_key = ${idempotencyKey}
  `
  if (existing) return mapRow(existing)

  const intentId = v5Id("fin")
  const intent = createFinancialIntent(input, intentId)
  const row = await db.queryRow<FinancialIntentRow>`
    INSERT INTO financial_intents (
      id, organization_id, payload_json, status, idempotency_key
    )
    VALUES (
      ${intentId}, ${organizationId}, ${JSON.stringify(intent)}, 'CREATED', ${idempotencyKey}
    )
    RETURNING *
  `
  if (!row) throw APIError.internal("failed to create financial intent")
  return mapRow(row)
}

export async function authorizeStoredIntent(
  organizationId: string,
  intentId: string,
): Promise<{ grant: AuthorizationGrant; status: V5ExecutionStatus }> {
  const row = await db.queryRow<FinancialIntentRow>`
    SELECT * FROM financial_intents
    WHERE organization_id = ${organizationId} AND id = ${intentId}
  `
  if (!row) throw APIError.notFound("financial intent not found")

  const intent = row.payload_json
  const auth = await authorizeIntent(intent, async (candidate) => {
    if (!isX402GuardEnabled()) {
      return {
        grantId: v5Id("grant"),
        intentId: candidate.id,
        decision: "allow",
        limits: { reservedAmount: candidate.value.amount, asset: candidate.value.asset },
        policyVersion: "railguard-v5-demo",
        validUntil: candidate.constraints.expiresAt,
        executionConstraints: {
          networks: candidate.constraints.network ? [candidate.constraints.network] : [],
          recipients: candidate.counterparty.address ? [candidate.counterparty.address] : [],
        },
        evidenceHash: hashEvidencePart(candidate),
      }
    }
    const payer = await resolveCdpPayerAddress(organizationId)
    const guardInput = buildGuardInput(
      organizationId,
      candidate.id,
      buildExecutionCorrelation({
        paymentIntentId: candidate.id,
        executionIdempotencyKey: candidate.idempotencyKey,
        organizationID: organizationId,
        payerAddress: payer,
        recipientAddress: candidate.counterparty.address ?? `0x${"00".repeat(20)}`,
        amountBaseUnits: candidate.value.amount,
        tokenAddress: candidate.value.asset,
      }),
      candidate.idempotencyKey,
    )
    const guard = await evaluatePaymentGuard(guardInput)
    const decision =
      guard.decision.decision === "allow"
        ? ("allow" as const)
        : guard.decision.decision === "escalate"
          ? ("approval_required" as const)
          : ("deny" as const)
    return {
      grantId: guard.decision.authorizationId ?? v5Id("grant"),
      intentId: candidate.id,
      decision,
      limits: { reservedAmount: candidate.value.amount, asset: candidate.value.asset },
      policyVersion: "railguard-x402-v5",
      validUntil: candidate.constraints.expiresAt,
      executionConstraints: {
        networks: candidate.constraints.network ? [candidate.constraints.network] : [],
        recipients: candidate.counterparty.address ? [candidate.counterparty.address] : [],
      },
      evidenceHash: hashEvidencePart({ guard: guard.decision, intent: candidate.id }),
    }
  })

  await db.exec`
    UPDATE financial_intents
    SET status = ${auth.status},
        authorization_grant_json = ${JSON.stringify(auth.grant)},
        updated_at = NOW()
    WHERE id = ${intentId} AND organization_id = ${organizationId}
  `
  return auth
}

export async function linkPaymentIntentToFinancialIntent(
  organizationId: string,
  intentId: string,
  paymentIntentId: string,
  paymentStatus: string,
): Promise<void> {
  const executionId = v5Id("exec")
  const status = mapLegacyPaymentStatus(paymentStatus)
  await db.exec`
    UPDATE financial_intents
    SET payment_intent_id = ${paymentIntentId},
        execution_id = ${executionId},
        status = ${status},
        updated_at = NOW()
    WHERE id = ${intentId} AND organization_id = ${organizationId}
  `
}

export async function getStoredExecution(
  organizationId: string,
  executionId: string,
): Promise<ReturnType<typeof mapRow>> {
  const row = await db.queryRow<FinancialIntentRow>`
    SELECT * FROM financial_intents
    WHERE organization_id = ${organizationId} AND execution_id = ${executionId}
  `
  if (!row) throw APIError.notFound("execution not found")
  return mapRow(row)
}

export async function buildAndStoreEvidence(
  organizationId: string,
  executionId: string,
): Promise<EvidenceEnvelope> {
  const row = await db.queryRow<FinancialIntentRow>`
    SELECT * FROM financial_intents
    WHERE organization_id = ${organizationId} AND execution_id = ${executionId}
  `
  if (!row) throw APIError.notFound("execution not found")
  const envelope = buildEvidenceEnvelope({
    intent: row.payload_json,
    policyDecision: { status: row.status },
    authorizationGrant: row.authorization_grant_json ?? { grantId: "none" },
    execution: {
      provider: row.payment_intent_id ? "cdp" : "x402",
      submissionId: row.payment_intent_id ?? undefined,
    },
    settlement: {
      status: row.status === "SETTLED" ? "FINALIZED" : "UNOBSERVED",
      observedAt: row.updated_at.toISOString(),
    },
    policyVersion: row.authorization_grant_json?.policyVersion ?? "railguard-v5",
    sequence: 1,
  })
  await db.exec`
    UPDATE financial_intents
    SET evidence_json = ${JSON.stringify(envelope)}, updated_at = NOW()
    WHERE id = ${row.id}
  `
  return envelope
}

export function buildExplainCharge(
  row: ReturnType<typeof mapRow>,
): ReturnType<typeof explainCharge> {
  const envelope =
    row.evidence ??
    buildEvidenceEnvelope({
      intent: row.intent,
      policyDecision: { status: row.status },
      authorizationGrant: row.authorizationGrant ?? { grantId: "none" },
      execution: { provider: "unknown" },
      settlement: { status: "UNOBSERVED" },
      policyVersion: row.authorizationGrant?.policyVersion ?? "railguard-v5",
      sequence: 1,
    })
  return explainCharge(envelope, {
    agent: row.intent.principal.actorId,
    task: typeof row.intent.context?.task === "string" ? row.intent.context.task : undefined,
    requested: `${row.intent.value.amount} ${row.intent.value.asset}`,
    decision: row.authorizationGrant?.decision ?? "pending",
    rail: row.paymentIntentId ? "cdp" : "x402",
  })
}

export { organizationAgentId }
