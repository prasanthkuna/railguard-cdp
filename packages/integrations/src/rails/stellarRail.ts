import type { ExecutionRail } from "@railguard/kernel/executionRail"

/** Stellar — settlement verification path (SCF / non-EVM). */
export function createStellarExecutionRail(): ExecutionRail {
  const name = "stellar"
  const disabled = (): never => {
    throw new Error(
      `${name}: attach tx hash via RAILGUARD_STELLAR_TX_HASH and use stellar-payment-assurance-kit verify`,
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
