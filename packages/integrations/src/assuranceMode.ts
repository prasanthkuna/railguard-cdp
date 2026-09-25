/** Plan §2 — OBSERVE | GUARD | ENFORCE adoption modes. */

export type AssuranceMode = "OBSERVE" | "GUARD" | "ENFORCE"

export interface AssuranceModeBehavior {
  mode: AssuranceMode
  canBlockAuthorization: boolean
  canBlockExecution: boolean
  onChainHookRequired: boolean
}

export function resolveAssuranceMode(raw?: string): AssuranceMode {
  const value = (raw ?? process.env.RAILGUARD_ASSURANCE_MODE ?? "GUARD").toUpperCase()
  if (value === "OBSERVE" || value === "GUARD" || value === "ENFORCE") return value
  return "GUARD"
}

export function describeAssuranceMode(mode: AssuranceMode): AssuranceModeBehavior {
  switch (mode) {
    case "OBSERVE":
      return {
        mode,
        canBlockAuthorization: false,
        canBlockExecution: false,
        onChainHookRequired: false,
      }
    case "GUARD":
      return {
        mode,
        canBlockAuthorization: true,
        canBlockExecution: true,
        onChainHookRequired: false,
      }
    case "ENFORCE":
      return {
        mode,
        canBlockAuthorization: true,
        canBlockExecution: true,
        onChainHookRequired: true,
      }
  }
}

export function protectRecommendations(mode: AssuranceMode = resolveAssuranceMode()): string[] {
  const steps = [
    "Set RAILGUARD_ASSURANCE_MODE=GUARD (or ENFORCE with railguard-protocol hook deployed)",
    "Set X402_GUARD_ENABLED=true for pre-sign budget + idempotency",
    "Set PAYMENT_MODE=live only with CDP secrets on Base Sepolia",
    "Run: railguard doctor --base-url <API>",
    "Run: railguard lab run --profiles APF-001,APF-002,APF-003",
  ]
  if (mode === "ENFORCE") {
    steps.push("Deploy RailguardExecutionHook + register sessions (railguard-protocol)")
  }
  if (mode === "OBSERVE") {
    steps.unshift("OBSERVE: policy decisions logged; set RAILGUARD_ASSURANCE_MODE=OBSERVE")
  }
  return steps
}
