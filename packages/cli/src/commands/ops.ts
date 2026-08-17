import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { RailguardEnv } from "../config"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")

export async function runVerify(env: RailguardEnv): Promise<number> {
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

export function runDoctor(env: RailguardEnv): void {
  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: env.baseUrl,
        hasToken: Boolean(env.accessToken),
        paymentMode: process.env.PAYMENT_MODE ?? "unset",
        x402Guard: process.env.X402_GUARD_ENABLED ?? "unset",
      },
      null,
      2,
    ),
  )
}
