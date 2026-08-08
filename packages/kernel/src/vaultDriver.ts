import type { PreparedExecution, SubmittedExecution, VaultExecutionDriver } from "./executionDriver"

/** Reference stub for v4 §24 CDP_VAULT_CALL — implement against on-chain vault contract. */
export class StubVaultExecutionDriver implements VaultExecutionDriver {
  async prepareVaultCall(request: {
    executionId: string
    intentHash: string
    token: string
    recipient: string
    amount: string
    expiry: number
  }): Promise<PreparedExecution> {
    return {
      executionId: request.executionId,
      provider: "cdp_vault_call",
      providerIdempotencyKey: request.executionId,
      requestHash: request.intentHash,
      canonicalRequest: { ...request, mode: "CDP_VAULT_CALL" },
    }
  }

  async submitVaultCall(executionId: string): Promise<SubmittedExecution> {
    return {
      executionId,
      result: "REJECTED_BEFORE_BROADCAST",
      responseHash: undefined,
    }
  }
}
