/** v5 CDP ExecutionRail adapter — wraps existing kernel cdpDriver concepts */

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

export interface CdpRailConfig {
  organizationId: string
  payerAddress: string
}

export function createCdpExecutionRail(config: CdpRailConfig): ExecutionRail {
  return {
    name: "cdp",

    async prepare(intent: FinancialIntent, grant: AuthorizationGrant): Promise<PreparedExecution> {
      const canonicalRequest = {
        to: intent.counterparty.address,
        amount: intent.value.amount,
        asset: intent.value.asset,
        network: intent.constraints.network,
        grantId: grant.grantId,
      }
      return {
        executionId: `exec_${intent.id}`,
        rail: "cdp",
        providerIdempotencyKey: intent.idempotencyKey,
        requestHash: createHash("sha256").update(JSON.stringify(canonicalRequest)).digest("hex"),
        canonicalRequest,
      }
    },

    async execute(prepared: PreparedExecution): Promise<ExecutionSubmission> {
      return {
        executionId: prepared.executionId,
        rail: "cdp",
        result: "BROADCAST_UNKNOWN",
        responseHash: prepared.requestHash,
      }
    },

    async observe(submission: ExecutionSubmission): Promise<ExecutionObservation> {
      return {
        executionId: submission.executionId,
        txHash: submission.txHash,
        settlementStatus: submission.txHash ? "INCLUDED" : "UNOBSERVED",
        observedAt: new Date().toISOString(),
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
