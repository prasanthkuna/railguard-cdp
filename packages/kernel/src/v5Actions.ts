/** v5 §10 — public SDK actions: authorize, execute, verify */

import type { AuthorizationGrant } from "./authority"
import type { EvidenceEnvelope } from "./evidence"
import type { ExecutionRail, PreparedExecution, V5ExecutionStatus } from "./executionRail"
import { handleAmbiguousExecution, requiresReconciliation } from "./executionRail"
import type { FinancialIntent } from "./intent"

export interface AuthorizeResult {
  grant: AuthorizationGrant
  status: V5ExecutionStatus
}

export interface ExecuteResult {
  executionId: string
  status: V5ExecutionStatus
  submission?: {
    txHash?: string
    providerOperationId?: string
  }
  recovery?: ReturnType<typeof handleAmbiguousExecution>
}

export interface VerifyResult {
  executionId: string
  status: V5ExecutionStatus
  evidence: EvidenceEnvelope
  requiresReconciliation: boolean
}

export async function authorizeIntent(
  intent: FinancialIntent,
  evaluate: (intent: FinancialIntent) => Promise<AuthorizationGrant>,
): Promise<AuthorizeResult> {
  const grant = await evaluate(intent)
  const status: V5ExecutionStatus =
    grant.decision === "allow"
      ? "AUTHORIZED"
      : grant.decision === "approval_required"
        ? "APPROVAL_REQUIRED"
        : "DENIED"
  return { grant, status }
}

export async function executeIntent(
  intent: FinancialIntent,
  grant: AuthorizationGrant,
  rail: ExecutionRail,
): Promise<ExecuteResult> {
  const prepared = await rail.prepare(intent, grant)
  const submission = await rail.execute(prepared)
  if (submission.result === "BROADCAST_UNKNOWN") {
    return {
      executionId: prepared.executionId,
      status: "UNKNOWN",
      submission: {
        txHash: submission.txHash,
        providerOperationId: submission.providerOperationId,
      },
      recovery: handleAmbiguousExecution(grant.grantId),
    }
  }
  if (submission.result === "REJECTED_BEFORE_BROADCAST") {
    return { executionId: prepared.executionId, status: "FAILED_SAFE" }
  }
  return {
    executionId: prepared.executionId,
    status: submission.txHash ? "SUBMITTED" : "EXECUTING",
    submission: {
      txHash: submission.txHash,
      providerOperationId: submission.providerOperationId,
    },
  }
}

export async function verifyExecution(
  executionId: string,
  rail: ExecutionRail,
  buildEvidence: (executionId: string, observation: Awaited<ReturnType<ExecutionRail["observe"]>>) => EvidenceEnvelope,
  submission: Parameters<ExecutionRail["observe"]>[0],
): Promise<VerifyResult> {
  const observation = await rail.observe(submission)
  const settlement = await rail.reconcile(executionId)
  const evidence = buildEvidence(executionId, observation)
  const status: V5ExecutionStatus =
    settlement.decision === "SETTLED"
      ? "SETTLED"
      : settlement.decision === "REVERSED"
        ? "REVERSED"
        : settlement.decision === "DISPUTED"
          ? "DISPUTED"
          : "UNKNOWN"
  return {
    executionId,
    status,
    evidence,
    requiresReconciliation: requiresReconciliation(status),
  }
}

export async function pay(
  intent: FinancialIntent,
  evaluate: (intent: FinancialIntent) => Promise<AuthorizationGrant>,
  rail: ExecutionRail,
  buildEvidence: (executionId: string, observation: Awaited<ReturnType<ExecutionRail["observe"]>>) => EvidenceEnvelope,
): Promise<{ authorize: AuthorizeResult; execute: ExecuteResult; verify?: VerifyResult }> {
  const authorize = await authorizeIntent(intent, evaluate)
  if (authorize.status !== "AUTHORIZED") {
    return { authorize, execute: { executionId: intent.id, status: authorize.status } }
  }
  const execute = await executeIntent(intent, authorize.grant, rail)
  if (execute.status === "SUBMITTED" && execute.submission) {
    const verify = await verifyExecution(
      execute.executionId,
      rail,
      buildEvidence,
      {
        executionId: execute.executionId,
        rail: rail.name,
        txHash: execute.submission.txHash,
        providerOperationId: execute.submission.providerOperationId,
        result: "BROADCAST_CONFIRMED",
      },
    )
    return { authorize, execute, verify }
  }
  return { authorize, execute }
}
