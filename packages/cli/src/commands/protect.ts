import {
  describeAssuranceMode,
  protectRecommendations,
  resolveAssuranceMode,
} from "@railguard/integrations"
import { fetchJson } from "../client"
import type { RailguardEnv } from "../config"
import { requireToken } from "../config"

export async function runProtect(env: RailguardEnv): Promise<number> {
  const mode = resolveAssuranceMode()
  const behavior = describeAssuranceMode(mode)

  console.log(`Railguard protect — assurance mode: ${mode}`)
  console.log("")
  console.log("Recommended configuration:")
  for (const step of protectRecommendations(mode)) {
    console.log(`  • ${step}`)
  }
  console.log("")
  console.log(`On-chain hook required: ${behavior.onChainHookRequired ? "yes" : "no"}`)

  if (env.accessToken) {
    try {
      const token = requireToken(env)
      const posture = await fetchJson<{ duplicateProtection: string; reconciliation: string }>(
        `${env.baseUrl}/v1/posture/summary`,
        { headers: { authorization: `Bearer ${token}` } },
      )
      console.log("")
      console.log(`Current duplicate protection: ${posture.duplicateProtection}`)
      console.log(`Current reconciliation: ${posture.reconciliation}`)
    } catch {
      console.log("\n(Set RAILGUARD_ACCESS_TOKEN to compare live posture.)")
    }
  }

  console.log("")
  console.log("Next: railguard doctor  →  railguard verify <executionId>")
  return 0
}
