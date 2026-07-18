/** Pure execution safety checks — testable without Encore runtime. */

export type ExecutionSafetyViolation =
  | "kill_switch"
  | "org_not_allowed"
  | "live_ack_required"
  | "rate_limited"

export function getExecutionSafetyViolation(input: {
  organizationID: string
  paymentMode: "demo" | "live"
  acknowledgeLiveExecution?: boolean
  killSwitchActive: boolean
  demoOrgAllowlist: string[]
  recentExecutionTimestamps: number[]
  maxExecutionsPerHour: number
  now?: number
}): ExecutionSafetyViolation | null {
  if (input.killSwitchActive) return "kill_switch"

  if (
    input.demoOrgAllowlist.length > 0 &&
    !input.demoOrgAllowlist.includes(input.organizationID)
  ) {
    return "org_not_allowed"
  }

  if (input.paymentMode === "live" && input.acknowledgeLiveExecution !== true) {
    return "live_ack_required"
  }

  const now = input.now ?? Date.now()
  const windowMs = 60 * 60 * 1000
  const recent = input.recentExecutionTimestamps.filter((ts) => now - ts < windowMs)
  if (recent.length >= input.maxExecutionsPerHour) {
    return "rate_limited"
  }

  return null
}
