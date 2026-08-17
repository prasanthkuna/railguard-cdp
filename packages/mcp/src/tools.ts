import { RailguardClient } from "@railguard/sdk"
import type { CreateFinancialIntentInput } from "@railguard/sdk"
import { resolveRailguardEnv, requireToken } from "./config"

let cached: RailguardClient | null = null

export function getClient(): RailguardClient {
  if (cached) return cached
  const env = resolveRailguardEnv()
  const token = requireToken(env)
  cached = new RailguardClient({
    baseUrl: env.baseUrl,
    getAuthHeaders: () => ({ authorization: `Bearer ${token}` }),
  })
  return cached
}

export function resetClient(): void {
  cached = null
}

export async function toolCreateIntent(input: CreateFinancialIntentInput): Promise<unknown> {
  return getClient().createIntent(input)
}

export async function toolAuthorize(intentId: string): Promise<unknown> {
  return getClient().authorize(intentId)
}

export async function toolExecute(
  intentId: string,
  paymentIntentId?: string,
): Promise<unknown> {
  return getClient().execute(intentId, paymentIntentId ? { paymentIntentId } : undefined)
}

export async function toolVerify(executionId: string): Promise<unknown> {
  return getClient().verify(executionId)
}

export async function toolPay(
  input: CreateFinancialIntentInput,
  paymentIntentId?: string,
): Promise<unknown> {
  return getClient().pay(input, paymentIntentId ? { paymentIntentId } : undefined)
}

export async function toolMetrics(): Promise<unknown> {
  const env = resolveRailguardEnv()
  const token = requireToken(env)
  const res = await fetch(`${env.baseUrl}/v1/metrics/financial`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function toolDoctor(): Promise<unknown> {
  const env = resolveRailguardEnv()
  return {
    ok: true,
    baseUrl: env.baseUrl,
    hasToken: Boolean(env.accessToken),
    paymentMode: process.env.PAYMENT_MODE ?? "unset",
    x402Guard: process.env.X402_GUARD_ENABLED ?? "unset",
  }
}

export async function toolGetExecution(executionId: string): Promise<unknown> {
  const env = resolveRailguardEnv()
  const token = requireToken(env)
  const res = await fetch(`${env.baseUrl}/v1/executions/${executionId}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return res.json()
}
