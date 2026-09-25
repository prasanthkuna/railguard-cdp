import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { RailguardEnv } from "../config"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")
const labRoot = join(repoRoot, "..", "agent-payment-failure-lab")

const INJECT_PROFILES: Record<string, string> = {
  "rpc-timeout": "APF-003",
  "duplicate-retry": "APF-001",
  reorg: "APF-004",
  "signer-timeout": "APF-005",
}

export async function runInject(scenario: string, extraArgs: string[]): Promise<number> {
  const profile = INJECT_PROFILES[scenario]
  if (!profile) {
    console.error(`unknown inject scenario: ${scenario}`)
    console.error(`available: ${Object.keys(INJECT_PROFILES).join(", ")}`)
    return 1
  }
  const depth = extraArgs.find((a) => a.startsWith("--depth"))
  const profiles = depth ? `${profile}` : profile
  const proc = Bun.spawn(["npm", "run", "lab", "--", "--profiles", profiles], {
    cwd: labRoot,
    stdout: "inherit",
    stderr: "inherit",
  })
  return proc.exited
}

export async function runRaceBudget(requests: number): Promise<number> {
  console.log(`Running budget race conformance (APF-002) with ${requests} logical agents...`)
  const proc = Bun.spawn(["npm", "run", "lab", "--", "--profiles", "APF-002"], {
    cwd: labRoot,
    stdout: "inherit",
    stderr: "inherit",
  })
  return proc.exited
}

export async function runVerifyApf(profile: string, _env: RailguardEnv): Promise<number> {
  const id = profile.toUpperCase().startsWith("APF-") ? profile.toUpperCase() : `APF-${profile}`
  const proc = Bun.spawn(["npm", "run", "lab", "--", "--profiles", id], {
    cwd: labRoot,
    stdout: "inherit",
    stderr: "inherit",
  })
  return proc.exited
}
