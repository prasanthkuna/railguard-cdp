import { readFileSync } from "node:fs"
import { createClient } from "../client"
import type { RailguardEnv } from "../config"
import { requireToken } from "../config"
import type { CreateFinancialIntentInput } from "@railguard/sdk"

export async function runEvidence(env: RailguardEnv, executionId: string): Promise<void> {
  const client = createClient(env)
  const result = await client.verify(executionId)
  console.log(JSON.stringify(result, null, 2))
}

export async function runMetrics(env: RailguardEnv): Promise<void> {
  const token = requireToken(env)
  const metrics = await fetch(`${env.baseUrl}/v1/metrics/financial`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const text = await metrics.text()
  if (!metrics.ok) throw new Error(`HTTP ${metrics.status}: ${text}`)
  console.log(JSON.stringify(JSON.parse(text), null, 2))
}

export async function runAuthorize(env: RailguardEnv, intentId: string): Promise<void> {
  const client = createClient(env)
  const result = await client.authorize(intentId)
  console.log(JSON.stringify(result, null, 2))
}

export async function runExecute(
  env: RailguardEnv,
  intentId: string,
  paymentIntentId?: string,
): Promise<void> {
  const client = createClient(env)
  const result = await client.execute(intentId, paymentIntentId ? { paymentIntentId } : undefined)
  console.log(JSON.stringify(result, null, 2))
}

export async function runIntentCreate(env: RailguardEnv, inputPath?: string): Promise<void> {
  const client = createClient(env)
  const raw = inputPath ? readFileSync(inputPath, "utf8") : await Bun.stdin.text()
  const input = JSON.parse(raw) as CreateFinancialIntentInput
  const result = await client.createIntent(input)
  console.log(JSON.stringify(result, null, 2))
}

export async function runPay(env: RailguardEnv, inputPath?: string, paymentIntentId?: string): Promise<void> {
  const client = createClient(env)
  const raw = inputPath ? readFileSync(inputPath, "utf8") : await Bun.stdin.text()
  const input = JSON.parse(raw) as CreateFinancialIntentInput
  const result = await client.pay(input, paymentIntentId ? { paymentIntentId } : undefined)
  console.log(JSON.stringify(result, null, 2))
}
