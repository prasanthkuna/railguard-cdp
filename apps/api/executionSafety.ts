/** Execution safety controls for hosted demo and production. */

import { APIError } from "encore.dev/api"
import { resolvePaymentMode } from "./config"
import { getExecutionSafetyViolation } from "./executionSafetyPure"

const EXECUTION_KILL_SWITCH = process.env.EXECUTION_KILL_SWITCH === "true"
const MAX_EXECUTIONS_PER_ORG_PER_HOUR = Number(process.env.MAX_EXECUTIONS_PER_ORG_HOUR ?? "10")
const DEMO_ORG_ALLOWLIST = (process.env.DEMO_ORG_ALLOWLIST ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)

const executionTimestamps = new Map<string, number[]>()

function violationToError(violation: NonNullable<ReturnType<typeof getExecutionSafetyViolation>>) {
  switch (violation) {
    case "kill_switch":
      return APIError.failedPrecondition(
        "payment execution is temporarily disabled (kill switch active)",
      )
    case "org_not_allowed":
      return APIError.permissionDenied(
        "organization is not authorized for payment execution in this environment",
      )
    case "live_ack_required":
      return APIError.failedPrecondition(
        "PAYMENT_MODE=live requires acknowledgeLiveExecution=true on the execute request",
      )
    case "rate_limited":
      return APIError.resourceExhausted(
        `execution rate limit exceeded (${MAX_EXECUTIONS_PER_ORG_PER_HOUR}/hour per organization)`,
      )
  }
}

export function assertExecutionAllowed(input: {
  organizationID: string
  acknowledgeLiveExecution?: boolean
}): void {
  const now = Date.now()
  const history = executionTimestamps.get(input.organizationID) ?? []

  const violation = getExecutionSafetyViolation({
    organizationID: input.organizationID,
    paymentMode: resolvePaymentMode(),
    acknowledgeLiveExecution: input.acknowledgeLiveExecution,
    killSwitchActive: EXECUTION_KILL_SWITCH,
    demoOrgAllowlist: DEMO_ORG_ALLOWLIST,
    recentExecutionTimestamps: history,
    maxExecutionsPerHour: MAX_EXECUTIONS_PER_ORG_PER_HOUR,
    now,
  })

  if (violation) {
    throw violationToError(violation)
  }

  history.push(now)
  executionTimestamps.set(input.organizationID, history)
}

export function isExecutionKillSwitchActive(): boolean {
  return EXECUTION_KILL_SWITCH
}
