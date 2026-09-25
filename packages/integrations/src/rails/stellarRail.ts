import type { AuthorizationGrant } from "@railguard/kernel/authority"
import type {
  ExecutionObservation,
  ExecutionRail,
  ExecutionSubmission,
  PreparedExecution,
  SettlementResult,
} from "@railguard/kernel/executionRail"
import type { FinancialIntent } from "@railguard/kernel/intent"
import {
  STELLAR_TESTNET_EVIDENCE_TX,
  verifyStellarTestnetPayment,
} from "@railguard/settlement/stellar-testnet"

function stellarTxHash(): string {
  return process.env.RAILGUARD_STELLAR_TX_HASH?.trim() ?? STELLAR_TESTNET_EVIDENCE_TX
}

/** Stellar — settlement verification path (SCF / non-EVM, testnet). */
export function createStellarExecutionRail(): ExecutionRail {
  const name = "stellar"
  return {
    name,
    async prepare(
      _intent: FinancialIntent,
      _grant: AuthorizationGrant,
    ): Promise<PreparedExecution> {
      return {
        executionId: `stellar_${Date.now()}`,
        rail: name,
        providerIdempotencyKey: stellarTxHash(),
        requestHash: stellarTxHash(),
        canonicalRequest: { network: "stellar-testnet" },
      }
    },
    async execute(_prepared: PreparedExecution): Promise<ExecutionSubmission> {
      throw new Error(`${name}: use observe/reconcile with Horizon on testnet`)
    },
    async observe(submission: ExecutionSubmission): Promise<ExecutionObservation> {
      const txHash = submission.txHash ?? stellarTxHash()
      const result = await verifyStellarTestnetPayment({ txHash })
      return {
        executionId: submission.executionId,
        txHash,
        settlementStatus: result.status === "CONFIRMED" ? "FINALIZED" : "MISMATCH",
        observedAt: new Date().toISOString(),
      }
    },
    async reconcile(executionId: string): Promise<SettlementResult> {
      const txHash = stellarTxHash()
      const result = await verifyStellarTestnetPayment({
        txHash,
        expectedDestination: process.env.RAILGUARD_STELLAR_DESTINATION?.trim(),
        expectedAmount: process.env.RAILGUARD_STELLAR_AMOUNT?.trim(),
        expectedMemo: process.env.RAILGUARD_STELLAR_MEMO?.trim(),
      })
      const settled = result.status === "CONFIRMED"
      return {
        executionId,
        status: settled ? "RESOLVED" : "REQUIRED",
        decision: settled ? "SETTLED" : "UNKNOWN",
        observations: [
          {
            executionId,
            txHash,
            settlementStatus: settled ? "FINALIZED" : "MISMATCH",
            observedAt: new Date().toISOString(),
          },
        ],
      }
    },
  }
}
