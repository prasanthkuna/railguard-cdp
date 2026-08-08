/** v4 §10 execution-driver protocol — prepare / submit / observe / findByCorrelation */

export type BroadcastSubmissionResult =
  | "BROADCAST_CONFIRMED"
  | "BROADCAST_UNKNOWN"
  | "REJECTED_BEFORE_BROADCAST"

export interface PreparedExecution {
  executionId: string
  provider: string
  providerIdempotencyKey: string
  requestHash: string
  canonicalRequest: Record<string, unknown>
}

export interface SubmittedExecution {
  executionId: string
  providerOperationId?: string
  txHash?: string
  result: BroadcastSubmissionResult
  responseHash?: string
}

export interface ObservedSettlement {
  executionId: string
  txHash: string
  settlementStatus: "pending" | "confirmed" | "reverted" | "reconciliation_required"
  finalityConfidence?: "PROVISIONAL" | "SAFE" | "FINALIZED"
}

export interface ExecutionDriver {
  prepare(input: {
    organizationId: string
    paymentIntentId: string
    executionId: string
    recipientAddress: string
    amountBaseUnits: string
    chain: string
  }): Promise<PreparedExecution>

  submit(input: {
    organizationId: string
    executionId: string
    businessIdempotencyKey: string
  }): Promise<SubmittedExecution>

  observe(input: {
    organizationId: string
    executionId: string
    txHash: string
  }): Promise<ObservedSettlement>

  findByCorrelation(input: {
    organizationId: string
    executionId?: string
    providerIdempotencyKey?: string
    txHash?: string
  }): Promise<PreparedExecution | SubmittedExecution | null>
}

export interface VaultExecutionRequest {
  executionId: string
  intentHash: string
  token: string
  recipient: string
  amount: string
  expiry: number
}

export interface VaultExecutionDriver {
  prepareVaultCall(request: VaultExecutionRequest): Promise<PreparedExecution>
  submitVaultCall(executionId: string): Promise<SubmittedExecution>
}
