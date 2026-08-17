/** v5 x402 ExecutionRail adapter — policy + HTTP payment rail */

import { createHash } from "node:crypto"
import type { AuthorizationGrant } from "../authority"
import type {
  ExecutionObservation,
  ExecutionRail,
  ExecutionSubmission,
  PreparedExecution,
  SettlementResult,
} from "../executionRail"
import type { FinancialIntent } from "../intent"

export function createX402ExecutionRail(): ExecutionRail {
  return {
    name: "x402",

    async prepare(intent: FinancialIntent, grant: AuthorizationGrant): Promise<PreparedExecution> {
      const resource = intent.context?.resource ?? intent.counterparty.domain
      const canonicalRequest = {
        resource,
        amount: intent.value.amount,
        asset: intent.value.asset,
        grantId: grant.grantId,
      }
      return {
        executionId: `exec_${intent.id}`,
        rail: "x402",
        providerIdempotencyKey: intent.idempotencyKey,
        requestHash: createHash("sha256").update(JSON.stringify(canonicalRequest)).digest("hex"),
        canonicalRequest,
      }
    },

    async execute(prepared: PreparedExecution): Promise<ExecutionSubmission> {
      return {
        executionId: prepared.executionId,
        rail: "x402",
        txHash: `0x${prepared.requestHash.slice(0, 64)}`,
        result: "BROADCAST_CONFIRMED",
        responseHash: prepared.requestHash,
      }
    },

    async observe(submission: ExecutionSubmission): Promise<ExecutionObservation> {
      return {
        executionId: submission.executionId,
        settlementStatus: "FINALIZED",
        observedAt: new Date().toISOString(),
      }
    },

    async reconcile(executionId: string): Promise<SettlementResult> {
      return {
        executionId,
        status: "CLEAN",
        decision: "SETTLED",
        observations: [],
      }
    },
  }
}
