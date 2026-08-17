/** Grant-phase rails — interface conformance only (v5 §19: not enabled in production) */
import type {
  ExecutionObservation,
  ExecutionRail,
  ExecutionSubmission,
  PreparedExecution,
  SettlementResult,
} from "../executionRail"
import type { AuthorizationGrant } from "../authority"
import type { FinancialIntent } from "../intent"

function deferredRail(name: string): ExecutionRail {
  const disabled = (): never => {
    throw new Error(`${name} adapter is not enabled — enable via Railguard Cloud grant phase`)
  }
  return {
    name,
    prepare: disabled,
    execute: disabled,
    observe: disabled,
    reconcile: disabled,
  }
}

export const createArcExecutionRail = () => deferredRail("arc")
export const createSolanaExecutionRail = () => deferredRail("solana")
export const createStellarExecutionRail = () => deferredRail("stellar")
export const createStripeExecutionRail = () => deferredRail("stripe")

/** Stub for conformance registry — reports not enabled */
export function deferredRailDescriptor(name: string) {
  return { name, enabled: false, reason: "grant-phase adapter" }
}

export type { ExecutionRail, PreparedExecution, ExecutionSubmission, ExecutionObservation, SettlementResult, FinancialIntent, AuthorizationGrant }
