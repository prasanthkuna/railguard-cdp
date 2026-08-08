import { api } from "encore.dev/api"
import { CronJob } from "encore.dev/cron"
import { BASE_SEPOLIA_CHAIN, BASE_SEPOLIA_USDC } from "../../packages/cdp/src"
import type { ExpectedTransferFacts } from "../../packages/settlement/src"
import { db } from "./db"
import { transitionAfterSettlementVerification } from "./paymentReconciliation"
import { isReconcileCandidate } from "./paymentState"
import { verifySettlement } from "./providers"
import {
  commitPaymentGuardAuthorization,
  isX402GuardEnabled,
  organizationAgentId,
  recordPaymentSettlement,
  releasePaymentGuardAuthorization,
} from "./x402Guard"
import { completePurchaseFulfilmentForPaymentIntent } from "./purchaseFulfilment"

export interface PaymentIntentReconcileRow {
  id: string
  organization_id: string
  status: string
  tx_hash: string | null
  purchase_id: string | null
  payment_identifier: string | null
  chain: string
  token_address: string
  recipient_address: string
  amount_base_units: string
  execution_idempotency_key: string | null
  guard_authorization_id: string | null
  guard_receipt_id: string | null
  guard_status: string | null
  expected_chain_id: string | null
  expected_token: string | null
  expected_sender: string | null
  expected_recipient: string | null
  expected_amount: string | null
}

async function buildDemoSeed(row: PaymentIntentReconcileRow): Promise<string> {
  const attempt = await db.queryRow<{ provider_idempotency_key: string }>`
    SELECT provider_idempotency_key
    FROM execution_attempts
    WHERE organization_id = ${row.organization_id}
      AND payment_intent_id = ${row.id}
    ORDER BY created_at DESC
    LIMIT 1
  `
  const providerKey = attempt?.provider_idempotency_key ?? row.execution_idempotency_key ?? ""
  return [
    row.organization_id,
    row.id,
    providerKey,
    row.recipient_address,
    row.amount_base_units,
    row.chain,
  ].join(":")
}

function buildExpectedFacts(row: PaymentIntentReconcileRow): ExpectedTransferFacts {
  return {
    chainId: Number(row.expected_chain_id ?? "84532"),
    tokenAddress: row.expected_token ?? row.token_address ?? BASE_SEPOLIA_USDC,
    sender: row.expected_sender ?? "",
    recipient: row.expected_recipient ?? row.recipient_address,
    amount: BigInt(row.expected_amount ?? row.amount_base_units),
  }
}

export async function reconcilePaymentIntentRow(
  row: PaymentIntentReconcileRow,
): Promise<"confirmed" | "reverted" | "reconciliation_required" | "pending"> {
  if (!isReconcileCandidate(row.status, row.tx_hash) || !row.tx_hash) {
    return "pending"
  }

  await db.exec`
    UPDATE payment_intents
    SET reconciliation_attempts = reconciliation_attempts + 1
    WHERE organization_id = ${row.organization_id} AND id = ${row.id}
  `

  const verification = await verifySettlement({
    txHash: row.tx_hash,
    expected: row.chain === BASE_SEPOLIA_CHAIN ? buildExpectedFacts(row) : undefined,
    demoSeed: await buildDemoSeed(row),
  })

  const alreadyCommitted = row.guard_status === "committed"
  const transition = transitionAfterSettlementVerification(
    verification.status,
    row.guard_authorization_id ?? undefined,
    alreadyCommitted,
  )

  if (verification.status === "PENDING") {
    return "pending"
  }

  if (transition.shouldCommitGuard && row.guard_authorization_id && isX402GuardEnabled()) {
    await commitPaymentGuardAuthorization({
      organizationID: row.organization_id,
      authorizationId: row.guard_authorization_id,
      agentId: organizationAgentId(row.organization_id),
      amountBaseUnits: row.expected_amount ?? row.amount_base_units,
    })
  }

  if (transition.shouldReleaseGuard && row.guard_authorization_id) {
    await releasePaymentGuardAuthorization(row.organization_id, row.guard_authorization_id)
  }

  if (transition.shouldRecordSettlement && row.guard_receipt_id) {
    recordPaymentSettlement(row.organization_id, row.guard_receipt_id, row.tx_hash)
  }

  if (transition.paymentStatus) {
    await db.exec`
      UPDATE payment_intents
      SET
        status = ${transition.paymentStatus},
        settlement_status = ${transition.settlementStatus ?? "pending"},
        guard_status = COALESCE(${transition.guardStatus ?? null}, guard_status),
        confirmed_at = CASE WHEN ${transition.paymentStatus} = 'confirmed' THEN now() ELSE confirmed_at END,
        failure_reason = CASE
          WHEN ${transition.paymentStatus} = 'reconciliation_required' THEN ${verification.reason ?? "settlement facts mismatch"}
          WHEN ${transition.paymentStatus} = 'reverted' THEN 'transaction reverted on-chain'
          ELSE failure_reason
        END
      WHERE organization_id = ${row.organization_id} AND id = ${row.id}
    `
  }

  if (verification.status === "CONFIRMED" && row.tx_hash) {
    await completePurchaseFulfilmentForPaymentIntent({
      purchaseId: row.purchase_id,
      paymentIntentId: row.id,
      paymentIdentifier: row.payment_identifier,
      txHash: row.tx_hash,
    })
  }

  switch (verification.status) {
    case "CONFIRMED":
      return "confirmed"
    case "REVERTED":
      return "reverted"
    case "RECONCILIATION_REQUIRED":
      return "reconciliation_required"
    default:
      return "pending"
  }
}

export const reconcileSubmittedPayments = api(
  { expose: false, method: "POST", path: "/internal/reconcile-payments" },
  async (): Promise<{ reconciled: number }> => {
    const rows = await db.queryAll<PaymentIntentReconcileRow>`
      SELECT
        id,
        organization_id,
        status,
        tx_hash,
        purchase_id,
        payment_identifier,
        chain,
        token_address,
        recipient_address,
        amount_base_units,
        execution_idempotency_key,
        guard_authorization_id,
        guard_receipt_id,
        guard_status,
        expected_chain_id,
        expected_token,
        expected_sender,
        expected_recipient,
        expected_amount
      FROM payment_intents
      WHERE status IN ('submitted', 'unknown', 'reconciliation_required') AND tx_hash IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 50
    `

    let reconciled = 0
    for (const row of rows) {
      const outcome = await reconcilePaymentIntentRow(row)
      if (
        outcome === "confirmed" ||
        outcome === "reverted" ||
        outcome === "reconciliation_required"
      ) {
        reconciled += 1
      }
    }
    return { reconciled }
  },
)

new CronJob("reconcile-submitted-payments", {
  title: "Reconcile submitted CDP payments",
  every: "5m",
  endpoint: reconcileSubmittedPayments,
})
