import { formatUsdcLabel } from "@railguard/integrations/format"
import { fetchJson } from "../client"
import type { RailguardEnv } from "../config"
import { requireToken } from "../config"

interface PostureSummary {
  fundsExposedBaseUnits: string
  singleTxLimitBaseUnits: string
  dailyLimitBaseUnits: string
  unknownRecipientsAllowed: boolean
  unlimitedApprovals: number
  duplicateProtection: "ENABLED" | "MISSING"
  reconciliation: "ACTIVE" | "NEEDS_REVIEW"
  estimatedBlastRadiusBaseUnits: string
}

function padLine(label: string, value: string, width = 26): string {
  return `${label.padEnd(width)}${value}`
}

export async function runDoctor(env: RailguardEnv): Promise<void> {
  try {
    await fetchJson(`${env.baseUrl}/health`)
  } catch {
    console.log(padLine("API", "UNREACHABLE"))
    return
  }

  if (!env.accessToken) {
    const pub = await fetchJson<{ assuranceMode: string; duplicateProtection: string }>(
      `${env.baseUrl}/v1/posture/public`,
    )
    console.log(padLine("Funds exposed", "(sign in)"))
    console.log(padLine("Single-tx limit", "(sign in)"))
    console.log(padLine("Daily limit", "(sign in)"))
    console.log(padLine("Unknown recipients", "(sign in)"))
    console.log(padLine("Unlimited approvals", "(sign in)"))
    console.log(
      padLine("Duplicate protection", pub.duplicateProtection === "ENABLED" ? "ENABLED" : "MISSING"),
    )
    console.log(padLine("Reconciliation", "(sign in)"))
    console.log("")
    console.log("Estimated blast radius:")
    console.log("  (set RAILGUARD_ACCESS_TOKEN)")
    return
  }

  const token = requireToken(env)
  const posture = await fetchJson<PostureSummary>(`${env.baseUrl}/v1/posture/summary`, {
    headers: { authorization: `Bearer ${token}` },
  })

  console.log(padLine("Funds exposed", formatUsdcLabel(posture.fundsExposedBaseUnits)))
  console.log(padLine("Single-tx limit", formatUsdcLabel(posture.singleTxLimitBaseUnits)))
  console.log(padLine("Daily limit", formatUsdcLabel(posture.dailyLimitBaseUnits)))
  console.log(
    padLine("Unknown recipients", posture.unknownRecipientsAllowed ? "ALLOWED" : "RESTRICTED"),
  )
  console.log(padLine("Unlimited approvals", String(posture.unlimitedApprovals)))
  console.log(
    padLine("Duplicate protection", posture.duplicateProtection === "ENABLED" ? "ENABLED" : "MISSING"),
  )
  console.log(
    padLine(
      "Reconciliation",
      posture.reconciliation === "ACTIVE" ? "ACTIVE" : "NEEDS REVIEW",
    ),
  )
  console.log("")
  console.log("Estimated blast radius:")
  console.log(`  ${formatUsdcLabel(posture.estimatedBlastRadiusBaseUnits)}`)
}
