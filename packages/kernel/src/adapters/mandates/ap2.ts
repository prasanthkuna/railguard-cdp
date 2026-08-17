/** v5 §12 — AP2 mandates normalize to FinancialIntent */
import { createFinancialIntent, type CreateFinancialIntentInput, type FinancialIntent } from "../../intent"

export interface Ap2Mandate {
  mandateId: string
  organizationId: string
  agentId: string
  merchantDomain: string
  maxAmount: string
  asset: string
  purpose?: string
  expiresAt: string
  idempotencyKey: string
}

export function mandateToFinancialIntent(mandate: Ap2Mandate, intentId: string): FinancialIntent {
  const input: CreateFinancialIntentInput = {
    principal: {
      organizationId: mandate.organizationId,
      actorId: mandate.agentId,
      actorType: "agent",
    },
    action: { type: "purchase", purpose: mandate.purpose ?? mandate.mandateId },
    counterparty: { domain: mandate.merchantDomain },
    value: { amount: mandate.maxAmount, asset: mandate.asset, maxAmount: mandate.maxAmount },
    constraints: { expiresAt: mandate.expiresAt },
    context: { mandateId: mandate.mandateId, protocol: "ap2" },
    idempotencyKey: mandate.idempotencyKey,
  }
  return createFinancialIntent(input, intentId)
}
