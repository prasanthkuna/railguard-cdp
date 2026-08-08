import type { GuardSqlExecutor } from "../../vendor/x402-guard/packages/policy/src/index"
import type { SQLDatabase } from "encore.dev/storage/sqldb"

type SqlTx = Awaited<ReturnType<SQLDatabase["begin"]>>

function createTxExecutor(tx: SqlTx): GuardSqlExecutor {
  return {
    queryRow: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[],
    ): Promise<T | null> => {
      if (sql.includes("x402_guard_budget_authorizations") && sql.includes("SUM(amount_atomic)")) {
        const [agentId, cutoff] = params as [string, Date]
        return tx.queryRow<T>`
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
      }
      if (sql.includes("UPDATE x402_guard_budget_authorizations") && sql.includes("RETURNING")) {
        const [authorizationId] = params as [string]
        return tx.queryRow<T>`
          UPDATE x402_guard_budget_authorizations
          SET status = 'committed'
          WHERE authorization_id = ${authorizationId} AND status = 'reserved'
          RETURNING agent_id, amount_atomic::text
        `
      }
      throw new Error(`unsupported guard tx query: ${sql.slice(0, 80)}`)
    },
    exec: async (sql: string, params: unknown[]): Promise<void> => {
      if (sql.includes("pg_advisory_xact_lock")) {
        const [lockKey] = params as [string]
        await tx.exec`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`
        return
      }
      if (sql.includes("INSERT INTO x402_guard_budget_authorizations")) {
        const [authorizationId, agentId, amountAtomic, createdAt] = params as [
          string,
          string,
          string,
          Date,
        ]
        await tx.exec`
          INSERT INTO x402_guard_budget_authorizations (
            authorization_id, agent_id, amount_atomic, status, created_at, scope_type, scope_id
          )
          VALUES (
            ${authorizationId}, ${agentId}, ${amountAtomic}, 'reserved', ${createdAt}, 'agent', ${agentId}
          )
        `
        return
      }
      if (sql.includes("INSERT INTO x402_guard_spends")) {
        const [agentId, amountAtomic, createdAt] = params as [string, string, Date]
        await tx.exec`
          INSERT INTO x402_guard_spends (agent_id, amount_atomic, created_at)
          VALUES (${agentId}, ${amountAtomic}, ${createdAt})
        `
        return
      }
      throw new Error(`unsupported guard tx exec: ${sql.slice(0, 80)}`)
    },
    transaction: async () => {
      throw new Error("nested guard transactions are not supported")
    },
  }
}

export function createEncoreGuardSqlExecutor(database: SQLDatabase): GuardSqlExecutor {
  return {
    queryRow: async <T extends Record<string, unknown>>(
      sql: string,
      params: unknown[],
    ): Promise<T | null> => {
      if (sql.includes("x402_guard_replays")) {
        const [fingerprint, now, expiresAt] = params as [string, Date, Date]
        return database.queryRow<T>`
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
      }
      if (sql.includes("SUM(amount_atomic)") && sql.includes("x402_guard_spends")) {
        const [agentId, cutoff] = params as [string, Date]
        return database.queryRow<T>`
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
      }
      throw new Error(`unsupported guard query: ${sql.slice(0, 80)}`)
    },
    exec: async (sql: string, params: unknown[]): Promise<void> => {
      if (sql.includes("UPDATE x402_guard_budget_authorizations") && sql.includes("released")) {
        const [authorizationId] = params as [string]
        await database.exec`
          UPDATE x402_guard_budget_authorizations
          SET status = 'released'
          WHERE authorization_id = ${authorizationId} AND status = 'reserved'
        `
        return
      }
      throw new Error(`unsupported guard exec: ${sql.slice(0, 80)}`)
    },
    transaction: async <T>(fn: (tx: GuardSqlExecutor) => Promise<T>): Promise<T> => {
      const tx = await database.begin()
      try {
        const result = await fn(createTxExecutor(tx))
        if (result === false) {
          await tx.rollback()
          return result
        }
        await tx.commit()
        return result
      } catch (error) {
        await tx.rollback()
        throw error
      }
    },
  }
}
