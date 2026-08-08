import type { GuardStateStore, SpendWindow } from "./storage";
export interface GuardSqlRow {
    [key: string]: unknown;
}
/** Database port for durable guard state — apps provide Encore/SQL adapters. */
export interface GuardSqlExecutor {
    queryRow<T extends GuardSqlRow>(sql: string, params: unknown[]): Promise<T | null>;
    exec(sql: string, params: unknown[]): Promise<void>;
    transaction<T>(fn: (tx: GuardSqlExecutor) => Promise<T>): Promise<T>;
}
/** Postgres-backed durable guard state (v4 §5–6). */
export declare class PostgresGuardStateStore implements GuardStateStore {
    private readonly sql;
    constructor(sql: GuardSqlExecutor);
    claimReplay(fingerprint: string, ttlMs: number, nowMs?: number): Promise<boolean>;
    reserveBudget(agentId: string, amountAtomic: bigint, windows: SpendWindow[], authorizationId: string, nowMs?: number): Promise<boolean>;
    commitAuthorization(authorizationId: string, agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
    releaseAuthorization(authorizationId: string): Promise<void>;
    sumSpendInWindow(agentId: string, windowSeconds: number, nowMs?: number): Promise<bigint>;
}
