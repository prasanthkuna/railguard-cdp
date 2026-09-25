import type { ExecutionRail } from "@railguard/kernel/executionRail"

/** Airwallex — fiat payout API executor (Oct 5 GO/NO-GO). */
export function createAirwallexExecutionRail(): ExecutionRail {
  const name = "airwallex"
  const disabled = (): never => {
    throw new Error(
      `${name}: set AIRWALLEX_API_KEY after hackathon rules — same FinancialIntent → reconcile model`,
    )
  }
  return {
    name,
    prepare: disabled,
    execute: disabled,
    observe: disabled,
    reconcile: disabled,
  }
}
