import { describe, expect, it } from "vitest"
import {
  PostgresGuardStateStore,
  type GuardSqlExecutor,
  type GuardSqlRow,
} from "./postgresStore"

class MemoryGuardSqlExecutor implements GuardSqlExecutor {
  private readonly replays = new Map<string, Date>()
  private readonly authorizations = new Map<
    string,
    { agentId: string; amountAtomic: string; status: string; createdAt: Date }
  >()
  private readonly spends: Array<{ agentId: string; amountAtomic: string; createdAt: Date }> = []

  async queryRow<T extends GuardSqlRow>(sql: string, params: unknown[]): Promise<T | null> {
    if (sql.includes("x402_guard_replays")) {
      const [fingerprint, now, expiresAt] = params as [string, Date, Date]
      const existing = this.replays.get(fingerprint)
      if (existing && existing > now) {
        return null
      }
      if (existing && existing <= now) {
        this.replays.delete(fingerprint)
      }
      this.replays.set(fingerprint, expiresAt)
      return { fingerprint } as T
    }
    if (sql.includes("SUM(amount_atomic)")) {
      const [agentId, cutoff] = params as [string, Date]
      let total = 0n
      for (const spend of this.spends) {
        if (spend.agentId === agentId && spend.createdAt >= cutoff) {
          total += BigInt(spend.amountAtomic)
        }
      }
      for (const auth of this.authorizations.values()) {
        if (auth.agentId === agentId && auth.status === "reserved" && auth.createdAt >= cutoff) {
          total += BigInt(auth.amountAtomic)
        }
      }
      return { total: total.toString() } as T
    }
    if (sql.includes("UPDATE x402_guard_budget_authorizations") && sql.includes("RETURNING")) {
      const [authorizationId] = params as [string]
      const auth = this.authorizations.get(authorizationId)
      if (!auth || auth.status !== "reserved") {
        return null
      }
      auth.status = "committed"
      return { agent_id: auth.agentId, amount_atomic: auth.amountAtomic } as T
    }
    throw new Error(`unsupported query in memory executor: ${sql.slice(0, 60)}`)
  }

  async exec(sql: string, params: unknown[]): Promise<void> {
    if (sql.includes("INSERT INTO x402_guard_budget_authorizations")) {
      const [authorizationId, agentId, amountAtomic, createdAt] = params as [
        string,
        string,
        string,
        Date,
      ]
      this.authorizations.set(authorizationId, {
        agentId,
        amountAtomic,
        status: "reserved",
        createdAt,
      })
      return
    }
    if (sql.includes("INSERT INTO x402_guard_spends")) {
      const [agentId, amountAtomic, createdAt] = params as [string, string, Date]
      this.spends.push({ agentId, amountAtomic, createdAt })
      return
    }
    if (sql.includes("released")) {
      const [authorizationId] = params as [string]
      const auth = this.authorizations.get(authorizationId)
      if (auth?.status === "reserved") {
        auth.status = "released"
      }
      return
    }
    if (sql.includes("pg_advisory_xact_lock")) {
      return
    }
    throw new Error(`unsupported exec in memory executor: ${sql.slice(0, 60)}`)
  }

  async transaction<T>(fn: (tx: GuardSqlExecutor) => Promise<T>): Promise<T> {
    return fn(this)
  }
}

describe("PostgresGuardStateStore", () => {
  it("claims replay fingerprints once per ttl window", async () => {
    const store = new PostgresGuardStateStore(new MemoryGuardSqlExecutor())
    expect(await store.claimReplay("fp-1", 60_000, 1_000)).toBe(true)
    expect(await store.claimReplay("fp-1", 60_000, 2_000)).toBe(false)
  })

  it("reserves, commits, and releases budget authorizations", async () => {
    const store = new PostgresGuardStateStore(new MemoryGuardSqlExecutor())
    const windows = [{ windowSeconds: 86_400, maxAmountAtomic: 1_000_000n }]
    expect(
      await store.reserveBudget("agent-1", 500_000n, windows, "auth-1", 10_000),
    ).toBe(true)
    expect(
      await store.reserveBudget("agent-1", 600_000n, windows, "auth-2", 10_001),
    ).toBe(false)
    await store.commitAuthorization("auth-1", "agent-1", 500_000n, 10_002)
    expect(await store.sumSpendInWindow("agent-1", 86_400, 10_003)).toBe(500_000n)
    await store.releaseAuthorization("auth-2")
  })
})
