/** v5 §14 — financial SRE metrics */

export interface FinancialMetrics {
  fundsAtRisk: string
  authorizationHoldValue: string
  unknownExecutionCount: number
  unknownExecutionValue: string
  duplicatePreventedValue: string
  policyDeniedValue: string
  reconciliationAgeSeconds: number
  settlementLatencySeconds: number
  budgetUtilization: number
  manualApprovalValue: string
}

export const FINANCIAL_METRIC_NAMES = [
  "funds_at_risk",
  "authorization_hold_value",
  "unknown_execution_count",
  "unknown_execution_value",
  "duplicate_prevented_value",
  "policy_denied_value",
  "reconciliation_age",
  "settlement_latency",
  "budget_utilization",
  "manual_approval_value",
] as const

export function emptyFinancialMetrics(): FinancialMetrics {
  return {
    fundsAtRisk: "0",
    authorizationHoldValue: "0",
    unknownExecutionCount: 0,
    unknownExecutionValue: "0",
    duplicatePreventedValue: "0",
    policyDeniedValue: "0",
    reconciliationAgeSeconds: 0,
    settlementLatencySeconds: 0,
    budgetUtilization: 0,
    manualApprovalValue: "0",
  }
}
