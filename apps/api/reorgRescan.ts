import { api } from "encore.dev/api"
import { CronJob } from "encore.dev/cron"
import type { Hash } from "viem"
import { createPublicClientForEvmChain } from "../../packages/settlement/src/evm-chain"
import { scanBlockAnchor } from "../../packages/settlement/src/reorg"
import { attachBlockAnchorForPaymentIntent } from "./blockAnchor"
import { db } from "./db"

interface AnchorRow {
  organization_id: string
  payment_intent_id: string
  execution_id: string
  tx_hash: string
  block_number: string
  block_hash: string
  chain: string
}

export async function rescanReorgAnchors(): Promise<{
  scanned: number
  reorgs: number
  anchored: number
}> {
  const rows = await db.queryAll<AnchorRow>`
    SELECT
      ea.organization_id,
      ea.payment_intent_id,
      ea.execution_id,
      ea.tx_hash,
      ea.block_number::text AS block_number,
      ea.block_hash,
      COALESCE(pi.chain, 'base-sepolia') AS chain
    FROM execution_attempts ea
    JOIN payment_intents pi
      ON pi.organization_id = ea.organization_id AND pi.id = ea.payment_intent_id
    WHERE ea.tx_hash IS NOT NULL
      AND ea.block_number IS NOT NULL
      AND ea.block_hash IS NOT NULL
      AND pi.status IN ('submitted', 'unknown', 'confirmed', 'reconciliation_required')
    ORDER BY ea.updated_at ASC
    LIMIT 100
  `

  let reorgs = 0
  let anchored = 0
  for (const row of rows) {
    const client = await createPublicClientForEvmChain(row.chain)
    const outcome = await scanBlockAnchor(client, {
      blockNumber: BigInt(row.block_number),
      blockHash: row.block_hash as Hash,
    })
    if (outcome === "reorg_detected") {
      reorgs += 1
      await db.exec`
        UPDATE execution_attempts
        SET status = 'UNKNOWN',
            response_json = COALESCE(response_json, '{}'::jsonb) || '{"reorgDetected":true}'::jsonb,
            updated_at = NOW()
        WHERE organization_id = ${row.organization_id}
          AND execution_id = ${row.execution_id}
      `
      await db.exec`
        UPDATE payment_intents
        SET status = 'unknown',
            failure_reason = 'chain_reorg',
            updated_at = NOW()
        WHERE organization_id = ${row.organization_id} AND id = ${row.payment_intent_id}
      `
      await db.exec`
        UPDATE financial_intents
        SET status = 'UNKNOWN', updated_at = NOW()
        WHERE organization_id = ${row.organization_id}
          AND payment_intent_id = ${row.payment_intent_id}
      `
      continue
    }
    if (outcome === "ok" && row.tx_hash) {
      anchored += 1
    }
  }

  const missingAnchor = await db.queryAll<{
    organization_id: string
    payment_intent_id: string
    tx_hash: string
    chain: string
  }>`
    SELECT ea.organization_id, ea.payment_intent_id, ea.tx_hash, COALESCE(pi.chain, 'base-sepolia') AS chain
    FROM execution_attempts ea
    JOIN payment_intents pi
      ON pi.organization_id = ea.organization_id AND pi.id = ea.payment_intent_id
    WHERE ea.tx_hash IS NOT NULL
      AND (ea.block_number IS NULL OR ea.block_hash IS NULL)
      AND pi.status IN ('submitted', 'confirmed', 'unknown', 'reconciliation_required')
    LIMIT 50
  `
  for (const row of missingAnchor) {
    await attachBlockAnchorForPaymentIntent({
      organizationId: row.organization_id,
      paymentIntentId: row.payment_intent_id,
      txHash: row.tx_hash,
      chain: row.chain,
    })
  }

  return { scanned: rows.length, reorgs, anchored }
}

export const runReorgRescan = api(
  { expose: false, method: "POST", path: "/internal/reorg-rescan" },
  async (): Promise<{ scanned: number; reorgs: number; anchored: number }> => {
    return rescanReorgAnchors()
  },
)

new CronJob("reorg-rescan", {
  title: "Detect EVM reorgs and rewind payment state",
  every: "10m",
  endpoint: runReorgRescan,
})
