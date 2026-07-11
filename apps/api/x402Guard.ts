import { parseResourceUrl } from "@x402-guard/core"
import { X402Guard, defaultDevPolicy } from "@x402-guard/middleware"
import type { GuardDecision } from "@x402-guard/core"
import type { PaymentReceipt } from "@x402-guard/middleware"

const guards = new Map<string, X402Guard>()

export function isX402GuardEnabled(): boolean {
  return process.env.X402_GUARD_ENABLED === "true"
}

/** Org-scoped agent identity for finance-triggered CDP execution. */
export function organizationAgentId(organizationID: string): string {
  return `org:${organizationID}`
}

function guardForOrganization(organizationID: string): X402Guard {
  let guard = guards.get(organizationID)
  if (!guard) {
    guard = new X402Guard({
      policy: defaultDevPolicy(organizationAgentId(organizationID)),
      policyVersion: "railguard-cdp-v0.1.0",
    })
    guards.set(organizationID, guard)
  }
  return guard
}

export interface PaymentGuardInput {
  organizationID: string
  payer: string
  payTo: string
  amountBaseUnits: string
  chain: string
  resourceUrl: string
  idempotencyKey?: string
}

export interface PaymentGuardResult {
  decision: GuardDecision
  receipt?: PaymentReceipt
}

export async function evaluatePaymentGuard(
  input: PaymentGuardInput,
): Promise<PaymentGuardResult> {
  const guard = guardForOrganization(input.organizationID)
  const decision = await guard.evaluate({
    agentId: organizationAgentId(input.organizationID),
    payer: input.payer,
    payTo: input.payTo,
    amountAtomic: BigInt(input.amountBaseUnits),
    asset: "USDC",
    network: input.chain,
    resource: parseResourceUrl(input.resourceUrl),
    idempotencyKey: input.idempotencyKey,
  })
  return { decision, receipt: guard.lastReceipt }
}

export function recordPaymentSettlement(
  organizationID: string,
  receiptId: string,
  txHash: string,
): PaymentReceipt | undefined {
  return guardForOrganization(organizationID).recordSettlement(receiptId, txHash)
}
