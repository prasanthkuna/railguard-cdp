import { api } from "encore.dev/api"
import { CronJob } from "encore.dev/cron"
import { BASE_SEPOLIA_CHAIN } from "../../packages/cdp/src"
import { db } from "./db"
import { waitForTransferConfirmation } from "./providers"
interface PaymentIntentRow {
  id: string
  organization_id: string
  status: string
  tx_hash: string | null
  chain: string
  recipient_address: string
  amount_base_units: string
}

export const reconcileSubmittedPayments = api(
  { expose: false, method: "POST", path: "/internal/reconcile-payments" },
  async (): Promise<{ reconciled: number }> => {
    const rows = await db.queryAll<PaymentIntentRow>`
      SELECT id, organization_id, status, tx_hash, chain, recipient_address, amount_base_units
      FROM payment_intents
      WHERE status IN ('submitted', 'unknown') AND tx_hash IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 50
    `

    let reconciled = 0
    for (const row of rows) {
      if (!row.tx_hash) continue
      try {
        if (row.chain === BASE_SEPOLIA_CHAIN) {
          await waitForTransferConfirmation(row.tx_hash)
        }
        await db.exec`
          UPDATE payment_intents
          SET status = 'confirmed', confirmed_at = now(), failure_reason = null
          WHERE organization_id = ${row.organization_id} AND id = ${row.id}
        `
        reconciled += 1
      } catch {
        // leave in submitted/unknown for a later pass
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
