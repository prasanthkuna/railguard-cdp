import type { GuardStateStore, SpendWindow } from "@x402-guard/policy"
import { db } from "./db"

/** Postgres-backed durable guard state with atomic replay claims and budget reservations. */
export class DbGuardStateStore implements GuardStateStore {
  async claimReplay(fingerprint: string, ttlMs: number, nowMs = Date.now()): Promise<boolean> {
    const expiresAt = new Date(nowMs + ttlMs)
    const now = new Date(nowMs)
    const row = await db.queryRow<{ fingerprint: string }>`
      WITH expired AS (
        DELETE FROM x402_guard_replays
        WHERE fingerprint = ${fingerprint} AND expires_at <= ${now}
      )
      INSERT INTO x402_guard_replays (fingerprint, expires_at)
      SELECT ${fingerprint}, ${expiresAt}
      WHERE NOT EXISTS (
        SELECT 1 FROM x402_guard_replays
        WHERE fingerprint = ${fingerprint} AND expires_at > ${now}
      )
      RETURNING fingerprint
    `
    return Boolean(row)
  }

  async reserveBudget(
    agentId: string,
    amountAtomic: bigint,
    windows: SpendWindow[],
    authorizationId: string,
    nowMs = Date.now(),
  ): Promise<boolean> {
    const tx = await db.begin()
    try {
      await tx.exec`SELECT pg_advisory_xact_lock(hashtext(${`x402-budget:${agentId}`}))`
      for (const window of windows) {
        const cutoff = new Date(nowMs - window.windowSeconds * 1000)
        const row = await tx.queryRow<{ total: string | null }>`
          SELECT (
            COALESCE((
              SELECT SUM(amount_atomic)
              FROM x402_guard_spends
              WHERE agent_id = ${agentId} AND created_at >= ${cutoff}
            ), 0)
            +
            COALESCE((
              SELECT SUM(amount_atomic)
              FROM x402_guard_budget_authorizations
              WHERE agent_id = ${agentId}
                AND status = 'reserved'
                AND created_at >= ${cutoff}
            ), 0)
          )::text AS total
        `
        const total = BigInt(row?.total ?? "0")
        if (total + amountAtomic > window.maxAmountAtomic) {
          await tx.rollback()
          return false
        }
      }
      await tx.exec`
        INSERT INTO x402_guard_budget_authorizations (authorization_id, agent_id, amount_atomic, status, created_at)
        VALUES (${authorizationId}, ${agentId}, ${amountAtomic.toString()}, 'reserved', ${new Date(nowMs)})
      `
      await tx.commit()
      return true
    } catch (error) {
      await tx.rollback()
      throw error
    }
  }

  async commitAuthorization(
    authorizationId: string,
    agentId: string,
    amountAtomic: bigint,
    nowMs = Date.now(),
  ): Promise<void> {
    const tx = await db.begin()
    try {
      const row = await tx.queryRow<{ agent_id: string; amount_atomic: string }>`
        UPDATE x402_guard_budget_authorizations
        SET status = 'committed'
        WHERE authorization_id = ${authorizationId} AND status = 'reserved'
        RETURNING agent_id, amount_atomic::text
      `
      if (!row) {
        throw new Error(`authorization not reserved: ${authorizationId}`)
      }
      if (row.agent_id !== agentId || row.amount_atomic !== amountAtomic.toString()) {
        throw new Error("authorization facts mismatch")
      }
      await tx.exec`
        INSERT INTO x402_guard_spends (agent_id, amount_atomic, created_at)
        VALUES (${agentId}, ${amountAtomic.toString()}, ${new Date(nowMs)})
      `
      await tx.commit()
    } catch (error) {
      await tx.rollback()
      throw error
    }
  }

  async releaseAuthorization(authorizationId: string): Promise<void> {
    await db.exec`
      UPDATE x402_guard_budget_authorizations
      SET status = 'released'
      WHERE authorization_id = ${authorizationId} AND status = 'reserved'
    `
  }

  async sumSpendInWindow(
    agentId: string,
    windowSeconds: number,
    nowMs = Date.now(),
  ): Promise<bigint> {
    const cutoff = new Date(nowMs - windowSeconds * 1000)
    const row = await db.queryRow<{ total: string | null }>`
      SELECT (
        COALESCE((
          SELECT SUM(amount_atomic)
          FROM x402_guard_spends
          WHERE agent_id = ${agentId} AND created_at >= ${cutoff}
        ), 0)
        +
        COALESCE((
          SELECT SUM(amount_atomic)
          FROM x402_guard_budget_authorizations
          WHERE agent_id = ${agentId}
            AND status = 'reserved'
            AND created_at >= ${cutoff}
        ), 0)
      )::text AS total
    `
    return BigInt(row?.total ?? "0")
  }
}
