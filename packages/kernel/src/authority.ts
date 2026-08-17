/** v5 §2 — AuthorizationGrant (replaces SignGate as external concept) */

export type AuthorityDecision = "allow" | "deny" | "approval_required"

export interface AuthorizationGrant {
  grantId: string
  intentId: string
  decision: AuthorityDecision
  limits: {
    reservedAmount: string
    asset: string
  }
  policyVersion: string
  validUntil: string
  executionConstraints: {
    recipients?: string[]
    networks?: string[]
    rails?: string[]
  }
  evidenceHash: string
}

export type BudgetScopeType = "organization" | "team" | "agent" | "merchant" | "resource" | "task"

export interface HierarchicalBudgetScope {
  scopeType: BudgetScopeType
  scopeId: string
  parentScopeType?: BudgetScopeType
  parentScopeId?: string
  limits: {
    daily?: string
    monthly?: string
    perTransaction?: string
  }
}

export type AuthorityReservationStatus =
  | "UNRESERVED"
  | "RESERVED"
  | "FROZEN"
  | "COMMITTED"
  | "RELEASED"

export interface AuthorityReservation {
  reservationId: string
  grantId: string
  status: AuthorityReservationStatus
  amount: string
  asset: string
}
