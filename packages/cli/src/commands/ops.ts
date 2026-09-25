import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { RailguardEnv } from "../config"
import { runDoctor } from "./doctor"
import { printExecutionVerifyReport } from "./verify-report"

export { runDoctor }

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")

async function resolveVerifyTarget(env: RailguardEnv, id: string): Promise<string> {
  if (id.startsWith("exec_")) return id
  const { requireToken } = await import("../config")
  const token = requireToken(env)
  const res = await fetch(`${env.baseUrl}/v1/intents/${id}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`intent lookup failed: ${res.status}`)
  const json = (await res.json()) as { executionId?: string; intent: { id: string } }
  return json.executionId ?? `exec_${json.intent.id}`
}

export async function runVerify(env: RailguardEnv, executionId?: string): Promise<number> {
  if (executionId) {
    const target = await resolveVerifyTarget(env, executionId)
    return printExecutionVerifyReport(env, target)
  }
  const proc = Bun.spawn(["bun", "run", "scripts/seed-and-verify.ts"], {
    cwd: repoRoot,
    env: { ...process.env, RAILGUARD_BASE_URL: env.baseUrl },
    stdout: "inherit",
    stderr: "inherit",
  })
  return proc.exited
}

export async function runLab(args: string[]): Promise<number> {
  const labRoot = join(repoRoot, "..", "agent-payment-failure-lab")
  const proc = Bun.spawn(["apf-lab", ...args], {
    cwd: labRoot,
    stdout: "inherit",
    stderr: "inherit",
  })
  return proc.exited
}
