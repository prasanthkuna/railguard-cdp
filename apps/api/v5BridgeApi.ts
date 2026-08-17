import { APIError, api } from "encore.dev/api"
import {
  buildAndStoreEvidence,
  buildExplainCharge,
  getStoredExecution,
  requireV5Actor,
} from "./v5Store"
import { getFinancialIntentByPaymentIntent } from "./v5Bridge"

/** Resolve v5 execution from legacy payment intent id */
export const getV1ExecutionByPaymentIntent = api(
  { expose: true, auth: true, method: "GET", path: "/v1/payment-intents/:id/execution" },
  async (params: { id: string }) => {
    const actor = await requireV5Actor(["owner", "finance", "approver", "viewer"])
    const linked = await getFinancialIntentByPaymentIntent(actor.organizationID, params.id)
    if (!linked?.executionId) throw APIError.notFound("no v5 execution linked to payment intent")
    return {
      financialIntentId: linked.financialIntentId,
      executionId: linked.executionId,
      status: linked.status,
    }
  },
)

/** Evidence for payment intent (convenience for invoice UI) */
export const getV1EvidenceByPaymentIntent = api(
  { expose: true, auth: true, method: "GET", path: "/v1/payment-intents/:id/evidence" },
  async (params: { id: string }) => {
    const actor = await requireV5Actor(["owner", "finance", "approver", "viewer"])
    const linked = await getFinancialIntentByPaymentIntent(actor.organizationID, params.id)
    if (!linked?.executionId) throw APIError.notFound("no v5 execution linked to payment intent")
    const stored = await getStoredExecution(actor.organizationID, linked.executionId)
    const evidence =
      stored.evidence ?? (await buildAndStoreEvidence(actor.organizationID, linked.executionId))
    return {
      executionId: linked.executionId,
      evidence,
      explain: buildExplainCharge({ ...stored, evidence }),
    }
  },
)
