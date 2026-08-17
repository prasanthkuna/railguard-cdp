/** v5 §3 — unified budget engine (hierarchical scopes) */

import type { HierarchicalBudgetScope } from "./authority"

export interface BudgetReservationRequest {
  scope: HierarchicalBudgetScope
  amount: string
  asset: string
  intentId: string
}

export interface BudgetReservationResult {
  reservationId: string
  scope: HierarchicalBudgetScope
  amount: string
  status: "reserved" | "denied" | "frozen"
  reason?: string
}

export interface BudgetEngine {
  reserve(request: BudgetReservationRequest): Promise<BudgetReservationResult>
  commit(reservationId: string): Promise<void>
  release(reservationId: string): Promise<void>
  freeze(scope: HierarchicalBudgetScope, reason: string): Promise<void>
}

export function resolveBudgetChain(
  scopes: HierarchicalBudgetScope[],
  leaf: HierarchicalBudgetScope,
): HierarchicalBudgetScope[] {
  const chain: HierarchicalBudgetScope[] = [leaf]
  let current = leaf
  while (current.parentScopeId && current.parentScopeType) {
    const parent = scopes.find(
      (s) => s.scopeId === current.parentScopeId && s.scopeType === current.parentScopeType,
    )
    if (!parent) break
    chain.unshift(parent)
    current = parent
  }
  return chain
}

export function canReserveWithinLimits(
  amount: string,
  limits: HierarchicalBudgetScope["limits"],
  used: { daily?: string; monthly?: string },
): boolean {
  const amt = BigInt(amount)
  if (limits.perTransaction && amt > BigInt(limits.perTransaction)) return false
  if (limits.daily && BigInt(used.daily ?? "0") + amt > BigInt(limits.daily)) return false
  if (limits.monthly && BigInt(used.monthly ?? "0") + amt > BigInt(limits.monthly)) return false
  return true
}
