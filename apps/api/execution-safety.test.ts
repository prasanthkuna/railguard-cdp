import { describe, expect, it } from "bun:test"
import { getExecutionSafetyViolation } from "./executionSafetyPure"

describe("execution safety (pure)", () => {
  it("requires live mode acknowledgement", () => {
    expect(
      getExecutionSafetyViolation({
        organizationID: "org_1",
        paymentMode: "live",
        acknowledgeLiveExecution: false,
        killSwitchActive: false,
        demoOrgAllowlist: [],
        recentExecutionTimestamps: [],
        maxExecutionsPerHour: 10,
      }),
    ).toBe("live_ack_required")
    expect(
      getExecutionSafetyViolation({
        organizationID: "org_1",
        paymentMode: "live",
        acknowledgeLiveExecution: true,
        killSwitchActive: false,
        demoOrgAllowlist: [],
        recentExecutionTimestamps: [],
        maxExecutionsPerHour: 10,
      }),
    ).toBeNull()
  })

  it("blocks when kill switch is active", () => {
    expect(
      getExecutionSafetyViolation({
        organizationID: "org_1",
        paymentMode: "demo",
        killSwitchActive: true,
        demoOrgAllowlist: [],
        recentExecutionTimestamps: [],
        maxExecutionsPerHour: 10,
      }),
    ).toBe("kill_switch")
  })

  it("enforces demo org allowlist when configured", () => {
    expect(
      getExecutionSafetyViolation({
        organizationID: "org_other",
        paymentMode: "demo",
        killSwitchActive: false,
        demoOrgAllowlist: ["org_demo_rollout"],
        recentExecutionTimestamps: [],
        maxExecutionsPerHour: 10,
      }),
    ).toBe("org_not_allowed")
  })

  it("rate limits per organization", () => {
    const now = Date.now()
    expect(
      getExecutionSafetyViolation({
        organizationID: "org_1",
        paymentMode: "demo",
        killSwitchActive: false,
        demoOrgAllowlist: [],
        recentExecutionTimestamps: [now - 1000, now - 2000],
        maxExecutionsPerHour: 2,
        now,
      }),
    ).toBe("rate_limited")
  })
})
