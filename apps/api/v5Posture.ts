import { describeAssuranceMode, resolveAssuranceMode } from "@railguard/integrations/assurance"
import { INTEGRATION_PARTNERS } from "@railguard/integrations/partners"
import { APIError, api } from "encore.dev/api"
import { requireV5Actor } from "./v5Store"

export interface PostureSummary {
  assuranceMode: string
  fundsExposedBaseUnits: string
  singleTxLimitBaseUnits: string
  dailyLimitBaseUnits: string
  unknownRecipientsAllowed: boolean
  unlimitedApprovals: number
  duplicateProtection: "ENABLED" | "MISSING"
  reconciliation: "ACTIVE" | "NEEDS_REVIEW"
  unknownExecutionCount: number
  estimatedBlastRadiusBaseUnits: string
  integrations: typeof INTEGRATION_PARTNERS
}

/** Plan §2 — doctor / protect posture (authenticated). */
export const getV1PostureSummary = api(
  { expose: true, auth: true, method: "GET", path: "/v1/posture/summary" },
  async (): Promise<PostureSummary> => {
    const actor = await requireV5Actor(["owner", "finance", "approver"])
    const { db } = await import("./db")

    const org = await db.queryRow<{
      hard_cap_base_units: string
      approval_threshold_base_units: string
      allowed_chain: string
    }>`
      SELECT hard_cap_base_units, approval_threshold_base_units, allowed_chain
      FROM organizations WHERE id = ${actor.organizationID}
    `
    if (!org) throw APIError.notFound("organization not found")

    const unknown = await db.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM financial_intents
      WHERE organization_id = ${actor.organizationID} AND status = 'UNKNOWN'
    `

    const vendorCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count FROM vendors
      WHERE organization_id = ${actor.organizationID} AND status = 'approved'
    `

    const walletCount = await db.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count FROM vendor_wallets
      WHERE organization_id = ${actor.organizationID}
    `

    const x402On = process.env.X402_GUARD_ENABLED === "true"
    const unknownCount = unknown?.count ?? 0
    const unlimitedApprovals = Math.max(0, (walletCount?.count ?? 0) - (vendorCount?.count ?? 0))

    const mode = resolveAssuranceMode()
    describeAssuranceMode(mode)

    return {
      assuranceMode: mode,
      fundsExposedBaseUnits: org.hard_cap_base_units,
      singleTxLimitBaseUnits: org.approval_threshold_base_units,
      dailyLimitBaseUnits: org.hard_cap_base_units,
      unknownRecipientsAllowed: !org.allowed_chain || org.allowed_chain === "*",
      unlimitedApprovals,
      duplicateProtection: x402On ? "ENABLED" : "MISSING",
      reconciliation: unknownCount === 0 ? "ACTIVE" : "NEEDS_REVIEW",
      unknownExecutionCount: unknownCount,
      estimatedBlastRadiusBaseUnits: org.hard_cap_base_units,
      integrations: INTEGRATION_PARTNERS,
    }
  },
)

/** Public labels for CLI doctor without auth (limited). */
export const getV1PosturePublic = api(
  { expose: true, method: "GET", path: "/v1/posture/public" },
  async (): Promise<{ assuranceMode: string; duplicateProtection: string; api: string }> => {
    return {
      assuranceMode: resolveAssuranceMode(),
      duplicateProtection: process.env.X402_GUARD_ENABLED === "true" ? "ENABLED" : "MISSING",
      api: "railguard",
    }
  },
)
