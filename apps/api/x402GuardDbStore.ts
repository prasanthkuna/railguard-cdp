import type { GuardStateStore } from "@x402-guard/policy"
import { db } from "./db"

/** Postgres-backed durable guard state for multi-instance CDP API. */
export class DbGuardStateStore implements GuardStateStore {
  async hasReplay(fingerprint: string, nowMs = Date.now()): Promise<boolean> {
    const row = await db.queryRow<{ expires_at: Date }>`
      SELECT expires_at FROM x402_guard_replays WHERE fingerprint = ${fingerprint}
    `
    if (!row) return false
    return row.expires_at.getTime() > nowMs
  }

  async markReplay(fingerprint: string, ttlMs: number, nowMs = Date.now()): Promise<void> {
    const expiresAt = new Date(nowMs + ttlMs)
    await db.exec`
      INSERT INTO x402_guard_replays (fingerprint, expires_at)
      VALUES (${fingerprint}, ${expiresAt})
      ON CONFLICT (fingerprint) DO UPDATE SET expires_at = EXCLUDED.expires_at
    `
  }

  async sumSpendInWindow(
    agentId: string,
    windowSeconds: number,
    nowMs = Date.now(),
  ): Promise<bigint> {
    const cutoff = new Date(nowMs - windowSeconds * 1000)
    const row = await db.queryRow<{ total: string | null }>`
      SELECT COALESCE(SUM(amount_atomic), 0)::text AS total
      FROM x402_guard_spends
      WHERE agent_id = ${agentId} AND created_at >= ${cutoff}
    `
    return BigInt(row?.total ?? "0")
  }

  async recordSpend(agentId: string, amountAtomic: bigint, nowMs = Date.now()): Promise<void> {
    if (amountAtomic <= 0n) throw new Error("cannot record non-positive spend")
    await db.exec`
      INSERT INTO x402_guard_spends (agent_id, amount_atomic, created_at)
      VALUES (${agentId}, ${amountAtomic.toString()}, ${new Date(nowMs)})
    `
  }
}
