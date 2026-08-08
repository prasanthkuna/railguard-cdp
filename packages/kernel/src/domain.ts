/** v4 §3 domain objects — versioned shapes for purchase lifecycle */

export type PurchaseStatus = "CREATED" | "QUOTED" | "APPROVED" | "PAID" | "FULFILLED" | "CLOSED"

export type QuoteStatus = "ACTIVE" | "SUPERSEDED" | "EXPIRED"

export type FulfilmentStatus = "PENDING" | "COMPLETED" | "FAILED"

export interface Purchase {
  id: string
  organizationId: string
  businessIdempotencyKey: string
  merchantId?: string
  status: PurchaseStatus
  createdAt: string
}

export interface Quote {
  id: string
  purchaseId: string
  version: number
  merchant: string
  resource: string
  method: string
  requestBodyHash: string
  network: string
  token: string
  recipient: string
  amount: string
  expiresAt: string
  status: QuoteStatus
}

export interface Fulfilment {
  id: string
  purchaseId: string
  merchantId: string
  fulfilmentId: string
  paymentIdentifier: string
  settlementReceipt?: string
  status: FulfilmentStatus
  resultJson?: Record<string, unknown>
}

export interface OutboxEvent {
  id: string
  aggregateType: string
  aggregateId: string
  eventType: string
  payload: Record<string, unknown>
  createdAt: string
  publishedAt?: string
}

export type BudgetScopeType = "organization" | "team" | "agent" | "merchant" | "resource"

export interface BudgetScope {
  scopeType: BudgetScopeType
  scopeId: string
  parentScopeType?: BudgetScopeType
  parentScopeId?: string
}
