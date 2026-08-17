/** v5 §9 — unified evidence envelope */

import { createHash } from "node:crypto"

export type SettlementStatus =
  | "UNOBSERVED"
  | "INCLUDED"
  | "SAFE"
  | "FINALIZED"
  | "MISMATCH"
  | "REVERSED"

export interface EvidenceEnvelope {
  intentHash: string
  policyDecisionHash: string
  authorizationGrantHash: string
  execution: {
    provider: string
    submissionId?: string
    txHash?: string
  }
  settlement: {
    status: SettlementStatus
    observedAt?: string
  }
  policyVersion: string
  sequence: number
  previousHash?: string
  signature?: string
}

export function hashEvidencePart(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function buildEvidenceEnvelope(input: {
  intent: unknown
  policyDecision: unknown
  authorizationGrant: unknown
  execution: EvidenceEnvelope["execution"]
  settlement: EvidenceEnvelope["settlement"]
  policyVersion: string
  sequence: number
  previousHash?: string
}): EvidenceEnvelope {
  return {
    intentHash: hashEvidencePart(input.intent),
    policyDecisionHash: hashEvidencePart(input.policyDecision),
    authorizationGrantHash: hashEvidencePart(input.authorizationGrant),
    execution: input.execution,
    settlement: input.settlement,
    policyVersion: input.policyVersion,
    sequence: input.sequence,
    previousHash: input.previousHash,
  }
}

export interface ExplainThisCharge {
  agent: string
  task?: string
  requested: string
  budget?: string
  merchant?: string
  policyVersion: string
  decision: string
  rail?: string
  settlement: string
  evidenceValid: boolean
}

export function explainCharge(envelope: EvidenceEnvelope, meta: {
  agent: string
  task?: string
  requested: string
  budget?: string
  merchant?: string
  decision: string
  rail?: string
}): ExplainThisCharge {
  const settled = ["FINALIZED", "SAFE", "INCLUDED"].includes(envelope.settlement.status)
  return {
    agent: meta.agent,
    task: meta.task,
    requested: meta.requested,
    budget: meta.budget,
    merchant: meta.merchant,
    policyVersion: envelope.policyVersion,
    decision: meta.decision,
    rail: meta.rail,
    settlement: settled ? "VERIFIED" : envelope.settlement.status,
    evidenceValid: Boolean(envelope.intentHash && envelope.authorizationGrantHash),
  }
}
