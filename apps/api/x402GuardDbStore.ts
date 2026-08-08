import { PostgresGuardStateStore } from "../../vendor/x402-guard/packages/policy/src/index"
import { db } from "./db"
import { createEncoreGuardSqlExecutor } from "./encoreGuardSqlAdapter"

/** Encore Postgres adapter over shared @x402-guard/policy PostgresGuardStateStore. */
export class DbGuardStateStore extends PostgresGuardStateStore {
  constructor() {
    super(createEncoreGuardSqlExecutor(db))
  }
}
