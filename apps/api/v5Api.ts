import { APIError, api } from "encore.dev/api"
import type { CreateFinancialIntentInput } from "../../packages/kernel/src/intent"
import type { AuthorizationGrant } from "../../packages/kernel/src/authority"
import type { EvidenceEnvelope } from "../../packages/kernel/src/evidence"
import type { V5ExecutionStatus } from "../../packages/kernel/src/executionRail"
import {
  authorizeStoredIntent,
  buildAndStoreEvidence,
  buildExplainCharge,
  createStoredFinancialIntent,
  getStoredExecution,
  requireV5Actor,
} from "./v5Store"

interface V5IntentResponse {
  intent: CreateFinancialIntentInput & { id: string }
  status: V5ExecutionStatus
  paymentIntentId?: string
  executionId?: string
  createdAt: string
}

interface V5AuthorizeResponse {
  grant: AuthorizationGrant
  status: V5ExecutionStatus
}

interface V5ExecutionResponse {
  executionId: string
  intentId: string
  status: V5ExecutionStatus
  paymentIntentId?: string
}

interface V5ExplainCharge {
  agent: string
  task?: string
  requested: string
  budget?: string
  merchant?: string
  policyVersion: string
  decision: string
  rail?: string
  settlement: string
  evidenceValid: boolean
}

interface V5EvidenceResponse {
  executionId: string
  evidence: EvidenceEnvelope
  explain: V5ExplainCharge
}

/** v5 §10 — POST /v1/intents */
export const createV1Intent = api(
  { expose: true, auth: true, method: "POST", path: "/v1/intents", sensitive: true },
  async (params: CreateFinancialIntentInput): Promise<V5IntentResponse> => {
    const actor = await requireV5Actor(["owner", "finance"])
    const stored = await createStoredFinancialIntent(actor.organizationID, params)
    return {
      intent: stored.intent,
      status: stored.status,
      paymentIntentId: stored.paymentIntentId,
      executionId: stored.executionId,
      createdAt: stored.createdAt,
    }
  },
)

/** v5 §10 — POST /v1/intents/:id/authorize */
export const authorizeV1Intent = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/v1/intents/:id/authorize",
    sensitive: true,
  },
  async (params: { id: string }): Promise<V5AuthorizeResponse> => {
    const actor = await requireV5Actor(["owner", "finance"])
    return authorizeStoredIntent(actor.organizationID, params.id)
  },
)

/** v5 §10 — POST /v1/intents/:id/execute (links to legacy payment intent when invoiceId in context) */
export const executeV1Intent = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/v1/intents/:id/execute",
    sensitive: true,
  },
  async (params: {
    id: string
    paymentIntentId?: string
    acknowledgeLiveExecution?: boolean
    idempotencyKey?: string
  }): Promise<V5ExecutionResponse> => {
    const actor = await requireV5Actor(["owner", "finance"])
    const stored = await getStoredExecutionByIntent(actor.organizationID, params.id)
    if (stored.status === "DENIED" || stored.status === "APPROVAL_REQUIRED") {
      throw APIError.failedPrecondition(`intent not authorized: ${stored.status}`)
    }
    if (!params.paymentIntentId && !stored.paymentIntentId) {
      throw APIError.invalidArgument(
        "paymentIntentId required — create legacy payment intent first or pass paymentIntentId",
      )
    }
    const paymentIntentId = params.paymentIntentId ?? stored.paymentIntentId
    if (!paymentIntentId) throw APIError.invalidArgument("paymentIntentId required")

    const { linkPaymentIntentToFinancialIntent } = await import("./v5Store")
    await linkPaymentIntentToFinancialIntent(
      actor.organizationID,
      params.id,
      paymentIntentId,
      "executing",
    )
    const updated = await getStoredExecutionByIntent(actor.organizationID, params.id)
    return {
      executionId: updated.executionId ?? `exec_${params.id}`,
      intentId: params.id,
      status: updated.status,
      paymentIntentId,
    }
  },
)

/** v5 §10 — GET /v1/executions/:id */
export const getV1Execution = api(
  { expose: true, auth: true, method: "GET", path: "/v1/executions/:id" },
  async (params: { id: string }): Promise<V5ExecutionResponse & { intentId: string }> => {
    const actor = await requireV5Actor(["owner", "finance", "approver"])
    const stored = await getStoredExecution(actor.organizationID, params.id)
    return {
      executionId: params.id,
      intentId: stored.intent.id,
      status: stored.status,
      paymentIntentId: stored.paymentIntentId,
    }
  },
)

/** v5 §9 — GET /v1/executions/:id/evidence */
export const getV1ExecutionEvidence = api(
  { expose: true, auth: true, method: "GET", path: "/v1/executions/:id/evidence" },
  async (params: { id: string }): Promise<V5EvidenceResponse> => {
    const actor = await requireV5Actor(["owner", "finance", "approver"])
    const stored = await getStoredExecution(actor.organizationID, params.id)
    const evidence = stored.evidence ?? (await buildAndStoreEvidence(actor.organizationID, params.id))
    const explain = buildExplainCharge({ ...stored, evidence })
    return { executionId: params.id, evidence, explain }
  },
)

/** v5 §14 — GET /v1/metrics/financial */
export const getV1FinancialMetrics = api(
  { expose: true, auth: true, method: "GET", path: "/v1/metrics/financial" },
  async (): Promise<{
    fundsAtRisk: string
    unknownExecutionCount: number
    budgetUtilization: number
  }> => {
    const actor = await requireV5Actor(["owner", "finance"])
    const unknown = await countUnknownExecutions(actor.organizationID)
    return {
      fundsAtRisk: unknown.amount,
      unknownExecutionCount: unknown.count,
      budgetUtilization: 0,
    }
  },
)

async function getStoredExecutionByIntent(organizationId: string, intentId: string) {
  const { db } = await import("./db")
  const row = await db.queryRow<{
    id: string
    payload_json: { id: string }
    status: V5ExecutionStatus
    payment_intent_id: string | null
    execution_id: string | null
    authorization_grant_json: AuthorizationGrant | null
    evidence_json: EvidenceEnvelope | null
    created_at: Date
    updated_at: Date
  }>`
    SELECT * FROM financial_intents WHERE organization_id = ${organizationId} AND id = ${intentId}
  `
  if (!row) throw APIError.notFound("financial intent not found")
  return {
    intent: row.payload_json,
    status: row.status,
    paymentIntentId: row.payment_intent_id ?? undefined,
    executionId: row.execution_id ?? undefined,
    authorizationGrant: row.authorization_grant_json ?? undefined,
    evidence: row.evidence_json ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

async function countUnknownExecutions(organizationId: string): Promise<{ count: number; amount: string }> {
  const { db } = await import("./db")
  const row = await db.queryRow<{ count: number; amount: string | null }>`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM((payload_json->'value'->>'amount')::numeric), 0)::text AS amount
    FROM financial_intents
    WHERE organization_id = ${organizationId} AND status = 'UNKNOWN'
  `
  return { count: row?.count ?? 0, amount: row?.amount ?? "0" }
}
