import type { CreateFinancialIntentInput, FinancialIntent } from "@railguard/kernel"
import type { AuthorizationGrant } from "@railguard/kernel"
import type { EvidenceEnvelope } from "@railguard/kernel"
import type { V5ExecutionStatus } from "@railguard/kernel"

export interface RailguardClientConfig {
  baseUrl: string
  getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>
}

export class RailguardClient {
  constructor(private readonly config: RailguardClientConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await this.config.getAuthHeaders()
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...headers,
        ...init?.headers,
      },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Railguard API ${response.status}: ${body}`)
    }
    return response.json() as Promise<T>
  }

  /** v5 public verb — create financial intent */
  async createIntent(input: CreateFinancialIntentInput): Promise<{
    intent: FinancialIntent
    status: V5ExecutionStatus
  }> {
    return this.request("/v1/intents", { method: "POST", body: JSON.stringify(input) })
  }

  /** v5 public verb — authorize */
  async authorize(intentId: string): Promise<{ grant: AuthorizationGrant; status: V5ExecutionStatus }> {
    return this.request(`/v1/intents/${intentId}/authorize`, { method: "POST", body: "{}" })
  }

  /** v5 public verb — execute (requires linked payment intent for CDP path) */
  async execute(
    intentId: string,
    options?: { paymentIntentId?: string; idempotencyKey?: string; acknowledgeLiveExecution?: boolean },
  ): Promise<{ executionId: string; status: V5ExecutionStatus }> {
    return this.request(`/v1/intents/${intentId}/execute`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    })
  }

  /** v5 public verb — verify via evidence endpoint */
  async verify(executionId: string): Promise<{
    executionId: string
    evidence: EvidenceEnvelope
    explain: Record<string, unknown>
  }> {
    return this.request(`/v1/executions/${executionId}/evidence`)
  }

  /** convenience — authorize → execute → verify */
  async pay(
    input: CreateFinancialIntentInput,
    options?: { paymentIntentId?: string },
  ): Promise<{
    intent: FinancialIntent
    grant: AuthorizationGrant
    executionId: string
    evidence?: EvidenceEnvelope
  }> {
    const created = await this.createIntent(input)
    const auth = await this.authorize(created.intent.id)
    if (auth.status !== "AUTHORIZED") {
      return { intent: created.intent, grant: auth.grant, executionId: created.intent.id }
    }
    const exec = await this.execute(created.intent.id, options)
    try {
      const verified = await this.verify(exec.executionId)
      return {
        intent: created.intent,
        grant: auth.grant,
        executionId: exec.executionId,
        evidence: verified.evidence,
      }
    } catch {
      return { intent: created.intent, grant: auth.grant, executionId: exec.executionId }
    }
  }
}

export { authorizeIntent, executeIntent, verifyExecution, pay } from "@railguard/kernel/v5Actions"
export { resolveRailguardEnv, requireToken, createClientFromEnv, type RailguardEnv } from "./env"
export type {
  FinancialIntent,
  CreateFinancialIntentInput,
  AuthorizationGrant,
  EvidenceEnvelope,
  V5ExecutionStatus,
} from "@railguard/kernel"
