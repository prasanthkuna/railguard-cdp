import type { GuardDecision } from "../../vendor/x402-guard/packages/core/src/index"
import { parseResourceUrl } from "../../vendor/x402-guard/packages/core/src/index"
import { X402Guard, defaultDevPolicy } from "../../vendor/x402-guard/packages/middleware/src/index"
import type { PaymentReceipt } from "../../vendor/x402-guard/packages/middleware/src/index"
import { DbGuardStateStore } from "./x402GuardDbStore"

const guards = new Map<string, X402Guard>()
const durableStore = new DbGuardStateStore()

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
      policy: {
        ...defaultDevPolicy(organizationAgentId(organizationID)),
        allowedAssets: ["USDC"],
        allowedNetworks: ["base-sepolia", "eip155:84532"],
      },
      policyVersion: "railguard-v5",
      stateStore: isX402GuardEnabled() ? durableStore : undefined,
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

export async function evaluatePaymentGuard(input: PaymentGuardInput): Promise<PaymentGuardResult> {
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

/** Records durable spend after settlement is verified (C-02 / H-12). */
export async function commitPaymentGuardSpend(
  input: PaymentGuardInput,
  receiptId: string,
): Promise<void> {
  const guard = guardForOrganization(input.organizationID)
  await guard.commitAllowedSpend(
    {
      agentId: organizationAgentId(input.organizationID),
      payer: input.payer,
      payTo: input.payTo,
      amountAtomic: BigInt(input.amountBaseUnits),
      asset: "USDC",
      network: input.chain,
      resource: parseResourceUrl(input.resourceUrl),
      idempotencyKey: input.idempotencyKey,
    },
    receiptId,
  )
}

/** Crash-safe commit path using durable authorization id from payment_intents. */
export async function commitPaymentGuardAuthorization(input: {
  organizationID: string
  authorizationId: string
  agentId: string
  amountBaseUnits: string
}): Promise<void> {
  await durableStore.commitAuthorization(
    input.authorizationId,
    input.agentId,
    BigInt(input.amountBaseUnits),
  )
}

export async function releasePaymentGuardAuthorization(
  organizationID: string,
  authorizationId: string,
): Promise<void> {
  await guardForOrganization(organizationID).releaseAuthorization(authorizationId)
}

export function paymentGuardInputFromCorrelation(input: {
  organizationID: string
  paymentIntentId: string
  expectedSender: string
  expectedRecipient: string
  expectedAmount: string
  chain: string
  executionIdempotencyKey?: string | null
}): PaymentGuardInput {
  return {
    organizationID: input.organizationID,
    payer: input.expectedSender,
    payTo: input.expectedRecipient,
    amountBaseUnits: input.expectedAmount,
    chain: input.chain,
    resourceUrl: `https://railguard.local/payment-intents/${input.paymentIntentId}`,
    idempotencyKey: input.executionIdempotencyKey ?? undefined,
  }
}
