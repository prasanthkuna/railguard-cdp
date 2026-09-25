import type { AuthorizationGrant } from "@railguard/kernel/authority"
import type {
  ExecutionObservation,
  ExecutionRail,
  ExecutionSubmission,
  PreparedExecution,
  SettlementResult,
} from "@railguard/kernel/executionRail"
import type { FinancialIntent } from "@railguard/kernel/intent"
import { verifyEvmChainTx } from "@railguard/settlement/evm-chain"

/** Read-only ExecutionRail — reconcile via on-chain settlement facts (no CDP broadcast). */
export function createSettlementVerifyRail(chainKey: string): ExecutionRail {
  return {
    name: chainKey,

    async prepare(intent: FinancialIntent, grant: AuthorizationGrant): Promise<PreparedExecution> {
      return {
        executionId: `exec_${intent.id}`,
        rail: chainKey,
        providerIdempotencyKey: intent.idempotencyKey,
        requestHash: grant.grantId,
        canonicalRequest: {
          network: intent.constraints.network,
          amount: intent.value.amount,
          counterparty: intent.counterparty.address,
        },
      }
    },

    async execute(prepared: PreparedExecution): Promise<ExecutionSubmission> {
      return {
        executionId: prepared.executionId,
        rail: chainKey,
        result: "REJECTED_BEFORE_BROADCAST",
        responseHash: prepared.requestHash,
      }
    },

    async observe(submission: ExecutionSubmission): Promise<ExecutionObservation> {
      if (!submission.txHash) {
        return {
          executionId: submission.executionId,
          settlementStatus: "UNOBSERVED",
          observedAt: new Date().toISOString(),
        }
      }
      try {
        const result = await verifyEvmChainTx({ chainId: chainKey, txHash: submission.txHash })
        const status =
          result.status === "CONFIRMED"
            ? "INCLUDED"
            : result.status === "PENDING"
              ? "UNOBSERVED"
              : "MISMATCH"
        return {
          executionId: submission.executionId,
          txHash: submission.txHash,
          settlementStatus: status,
          observedAt: new Date().toISOString(),
        }
      } catch {
        return {
          executionId: submission.executionId,
          txHash: submission.txHash,
          settlementStatus: "UNOBSERVED",
          observedAt: new Date().toISOString(),
        }
      }
    },

    async reconcile(executionId: string): Promise<SettlementResult> {
      return {
        executionId,
        status: "REQUIRED",
        decision: "UNKNOWN",
        observations: [],
      }
    },
  }
}
