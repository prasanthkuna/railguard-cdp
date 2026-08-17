/** v5 §1 — canonical financial intent (rail-agnostic) */

export type PrincipalType = "organization" | "human" | "agent" | "service" | "workflow"

export interface Principal {
  id: string
  type: PrincipalType
  organizationId: string
  parentPrincipalId?: string
}

export type FinancialActionType = "pay" | "purchase" | "transfer"

export interface FinancialIntent {
  id: string
  principal: {
    organizationId: string
    actorId: string
    actorType: "agent" | "human" | "service"
  }
  action: {
    type: FinancialActionType
    purpose?: string
  }
  counterparty: {
    id?: string
    address?: string
    domain?: string
  }
  value: {
    amount: string
    asset: string
    maxAmount?: string
  }
  constraints: {
    expiresAt: string
    network?: string
  }
  context?: Record<string, unknown>
  idempotencyKey: string
}

export interface CreateFinancialIntentInput {
  principal: FinancialIntent["principal"]
  action: FinancialIntent["action"]
  counterparty: FinancialIntent["counterparty"]
  value: FinancialIntent["value"]
  constraints: FinancialIntent["constraints"]
  context?: Record<string, unknown>
  idempotencyKey: string
}

export function createFinancialIntent(
  input: CreateFinancialIntentInput,
  id: string,
): FinancialIntent {
  return { id, ...input }
}

/** v5 §11 — child authority must be subset of parent */
export function isAuthoritySubset(
  child: { amount: string; asset: string; network?: string },
  parent: { amount: string; asset: string; network?: string },
): boolean {
  if (child.asset !== parent.asset) return false
  if (parent.network && child.network && child.network !== parent.network) return false
  return BigInt(child.amount) <= BigInt(parent.amount)
}
