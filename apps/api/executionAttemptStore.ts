import type { ExecutionAttemptRecord, ExecutionAttemptStatus } from "./cdpExecutionDriver"

export interface ExecutionAttemptStore {
  getOrCreate(input: {
    organizationId: string
    paymentIntentId: string
    executionId: string
    recipientAddress: string
    amountBaseUnits: string
    chain: string
  }): Promise<ExecutionAttemptRecord>
  updateAfterBroadcast(input: {
    organizationId: string
    executionId: string
    status: ExecutionAttemptStatus
    txHash?: string
    providerOperationId?: string
    responseHash?: string
    responseJson?: Record<string, unknown>
  }): Promise<void>
}

export class InMemoryExecutionAttemptStore implements ExecutionAttemptStore {
  private readonly attempts = new Map<string, ExecutionAttemptRecord>()

  private key(organizationId: string, executionId: string): string {
    return `${organizationId}:${executionId}`
  }

  async getOrCreate(
    input: Parameters<ExecutionAttemptStore["getOrCreate"]>[0],
  ): Promise<ExecutionAttemptRecord> {
    const { prepareExecutionAttempt } = await import("./cdpExecutionDriver")
    const existing = this.attempts.get(this.key(input.organizationId, input.executionId)) ?? null
    const attempt = prepareExecutionAttempt({ ...input, existing })
    if (!existing) {
      this.attempts.set(this.key(input.organizationId, input.executionId), { ...attempt })
    }
    return attempt
  }

  async updateAfterBroadcast(
    input: Parameters<ExecutionAttemptStore["updateAfterBroadcast"]>[0],
  ): Promise<void> {
    const stored = this.attempts.get(this.key(input.organizationId, input.executionId))
    if (!stored) {
      throw new Error(`execution attempt not found: ${input.executionId}`)
    }
    this.attempts.set(this.key(input.organizationId, input.executionId), {
      ...stored,
      status: input.status,
      txHash: input.txHash ?? stored.txHash,
      providerOperationId: input.providerOperationId ?? stored.providerOperationId,
      responseHash: input.responseHash ?? stored.responseHash,
    })
  }

  getAttempt(organizationId: string, executionId: string): ExecutionAttemptRecord | undefined {
    return this.attempts.get(this.key(organizationId, executionId))
  }

  size(): number {
    return this.attempts.size
  }
}
