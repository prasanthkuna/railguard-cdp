import type { GuardStateStore, SpendWindow } from "./storage"

export interface GuardSqlRow {
  [key: string]: unknown
}

/** Database port for durable guard state — apps provide Encore/SQL adapters. */
export interface GuardSqlExecutor {
  queryRow<T extends GuardSqlRow>(sql: string, params: unknown[]): Promise<T | null>
  exec(sql: string, params: unknown[]): Promise<void>
  transaction<T>(fn: (tx: GuardSqlExecutor) => Promise<T>): Promise<T>
}

/** Postgres-backed durable guard state (v4 §5–6). */
export class PostgresGuardStateStore implements GuardStateStore {
  constructor(private readonly sql: GuardSqlExecutor) {}

  async claimReplay(fingerprint: string, ttlMs: number, nowMs = Date.now()): Promise<boolean> {
    const expiresAt = new Date(nowMs + ttlMs)
    const now = new Date(nowMs)
    const row = await this.sql.queryRow<{ fingerprint: string }>(
      `WITH expired AS (
         DELETE FROM x402_guard_replays
         WHERE fingerprint = $1 AND expires_at <= $2
       )
       INSERT INTO x402_guard_replays (fingerprint, expires_at)
       SELECT $1, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM x402_guard_replays
         WHERE fingerprint = $1 AND expires_at > $2
       )
       RETURNING fingerprint`,
      [fingerprint, now, expiresAt],
    )
    return Boolean(row)
  }

  async reserveBudget(
    agentId: string,
    amountAtomic: bigint,
    windows: SpendWindow[],
    authorizationId: string,
    nowMs = Date.now(),
  ): Promise<boolean> {
    return this.sql.transaction(async (tx) => {
      await tx.exec("SELECT pg_advisory_xact_lock(hashtext($1))", [`x402-budget:${agentId}`])
      for (const window of windows) {
        const cutoff = new Date(nowMs - window.windowSeconds * 1000)
        const row = await tx.queryRow<{ total: string | null }>(
          `SELECT (
             COALESCE((
               SELECT SUM(amount_atomic)
               FROM x402_guard_spends
               WHERE agent_id = $1 AND created_at >= $2
             ), 0)
             +
             COALESCE((
               SELECT SUM(amount_atomic)
               FROM x402_guard_budget_authorizations
               WHERE agent_id = $1
                 AND status = 'reserved'
                 AND created_at >= $2
             ), 0)
           )::text AS total`,
          [agentId, cutoff],
        )
        const total = BigInt(row?.total ?? "0")
        if (total + amountAtomic > window.maxAmountAtomic) {
          return false
        }
      }
      await tx.exec(
        `INSERT INTO x402_guard_budget_authorizations
           (authorization_id, agent_id, amount_atomic, status, created_at, scope_type, scope_id)
         VALUES ($1, $2, $3, 'reserved', $4, 'agent', $2)`,
        [authorizationId, agentId, amountAtomic.toString(), new Date(nowMs)],
      )
      return true
    })
  }

  async commitAuthorization(
    authorizationId: string,
    agentId: string,
    amountAtomic: bigint,
    nowMs = Date.now(),
  ): Promise<void> {
    await this.sql.transaction(async (tx) => {
      const row = await tx.queryRow<{ agent_id: string; amount_atomic: string }>(
        `UPDATE x402_guard_budget_authorizations
         SET status = 'committed'
         WHERE authorization_id = $1 AND status = 'reserved'
         RETURNING agent_id, amount_atomic::text`,
        [authorizationId],
      )
      if (!row) {
        throw new Error(`authorization not reserved: ${authorizationId}`)
      }
      if (row.agent_id !== agentId || row.amount_atomic !== amountAtomic.toString()) {
        throw new Error("authorization facts mismatch")
      }
      await tx.exec(
        `INSERT INTO x402_guard_spends (agent_id, amount_atomic, created_at)
         VALUES ($1, $2, $3)`,
        [agentId, amountAtomic.toString(), new Date(nowMs)],
      )
    })
  }

  async releaseAuthorization(authorizationId: string): Promise<void> {
    await this.sql.exec(
      `UPDATE x402_guard_budget_authorizations
       SET status = 'released'
       WHERE authorization_id = $1 AND status = 'reserved'`,
      [authorizationId],
    )
  }

  async sumSpendInWindow(
    agentId: string,
    windowSeconds: number,
    nowMs = Date.now(),
  ): Promise<bigint> {
    const cutoff = new Date(nowMs - windowSeconds * 1000)
    const row = await this.sql.queryRow<{ total: string | null }>(
      `SELECT (
         COALESCE((
           SELECT SUM(amount_atomic)
           FROM x402_guard_spends
           WHERE agent_id = $1 AND created_at >= $2
         ), 0)
         +
         COALESCE((
           SELECT SUM(amount_atomic)
           FROM x402_guard_budget_authorizations
           WHERE agent_id = $1
             AND status = 'reserved'
             AND created_at >= $2
         ), 0)
       )::text AS total`,
      [agentId, cutoff],
    )
    return BigInt(row?.total ?? "0")
  }
}
