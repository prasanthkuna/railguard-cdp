import type { AuthorizationGrant } from "../../packages/kernel/src/authority"
import type { EvidenceEnvelope } from "../../packages/kernel/src/evidence"
import {
  mapLegacyPaymentStatus,
  type V5ExecutionStatus,
} from "../../packages/kernel/src/executionRail"
import type { CreateFinancialIntentInput } from "../../packages/kernel/src/intent"
import {
  authorizeStoredIntent,
  buildAndStoreEvidence,
  createStoredFinancialIntent,
  linkPaymentIntentToFinancialIntent,
} from "./v5Store"

interface InvoiceShape {
  id: string
  vendorID: string
  amountBaseUnits: string
  token: string
  chain: string
  walletAddress: string
}

/** Bridge legacy payment intents to v5 financial intents (§7 vendor-payment-agent path). */
export async function ensureFinancialIntentForPayment(input: {
  organizationId: string
  invoice: InvoiceShape
  paymentIntentId: string
  idempotencyKey: string
  actorId: string
}): Promise<{ financialIntentId: string; executionId: string; status: V5ExecutionStatus }> {
  const intentInput: CreateFinancialIntentInput = {
    principal: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: "human",
    },
    action: { type: "pay", purpose: `invoice:${input.invoice.id}` },
    counterparty: { id: input.invoice.vendorID, address: input.invoice.walletAddress },
    value: { amount: input.invoice.amountBaseUnits, asset: input.invoice.token.toUpperCase() },
    constraints: {
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      network: input.invoice.chain,
    },
    context: { invoiceId: input.invoice.id, paymentIntentId: input.paymentIntentId },
    idempotencyKey: `fin_${input.idempotencyKey}`,
  }

  const stored = await createStoredFinancialIntent(input.organizationId, intentInput)
  await authorizeStoredIntent(input.organizationId, stored.intent.id)
  await linkPaymentIntentToFinancialIntent(
    input.organizationId,
    stored.intent.id,
    input.paymentIntentId,
    "prepared",
  )

  const linked = await getFinancialIntentByPaymentIntent(input.organizationId, input.paymentIntentId)
  return {
    financialIntentId: stored.intent.id,
    executionId: linked?.executionId ?? `exec_${stored.intent.id}`,
    status: linked?.status ?? "AUTHORIZED",
  }
}

export async function syncFinancialIntentFromPaymentStatus(input: {
  organizationId: string
  paymentIntentId: string
  paymentStatus: string
  txHash?: string
}): Promise<void> {
  const linked = await getFinancialIntentByPaymentIntent(input.organizationId, input.paymentIntentId)
  if (!linked?.executionId) return

  const status = mapLegacyPaymentStatus(input.paymentStatus)
  const { db } = await import("./db")
  await db.exec`
    UPDATE financial_intents
    SET status = ${status}, updated_at = NOW()
    WHERE organization_id = ${input.organizationId} AND payment_intent_id = ${input.paymentIntentId}
  `

  if (status === "SETTLED" || status === "SUBMITTED" || status === "UNKNOWN") {
    await buildAndStoreEvidence(input.organizationId, linked.executionId)
  }
}

export async function getFinancialIntentByPaymentIntent(
  organizationId: string,
  paymentIntentId: string,
): Promise<{
  financialIntentId: string
  executionId?: string
  status: V5ExecutionStatus
  authorizationGrant?: AuthorizationGrant
  evidence?: EvidenceEnvelope
} | null> {
  const { db } = await import("./db")
  const row = await db.queryRow<{
    id: string
    status: V5ExecutionStatus
    execution_id: string | null
    authorization_grant_json: AuthorizationGrant | null
    evidence_json: EvidenceEnvelope | null
  }>`
    SELECT id, status, execution_id, authorization_grant_json, evidence_json
    FROM financial_intents
    WHERE organization_id = ${organizationId} AND payment_intent_id = ${paymentIntentId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!row) return null
  return {
    financialIntentId: row.id,
    executionId: row.execution_id ?? undefined,
    status: row.status,
    authorizationGrant: row.authorization_grant_json ?? undefined,
    evidence: row.evidence_json ?? undefined,
  }
}
