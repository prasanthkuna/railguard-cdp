import type { AgentPolicyConfig, PolicyEvaluation, X402PaymentContext } from "../../core/dist/index.js";
export interface SpendRecord {
    agentId: string;
    amountAtomic: bigint;
    atMs: number;
}
export declare class SpendTracker {
    private readonly records;
    record(agentId: string, amountAtomic: bigint, atMs?: number): void;
    sumInWindow(agentId: string, windowSeconds: number, nowMs?: number): bigint;
}
export declare class ReplayGuard {
    private readonly ttlMs;
    private readonly seen;
    constructor(ttlMs: number);
    check(fingerprint: string, nowMs?: number): boolean;
}
export declare function buildPaymentFingerprint(ctx: X402PaymentContext): string;
export declare function evaluateAgentPolicy(ctx: X402PaymentContext, policy: AgentPolicyConfig, tracker: SpendTracker): PolicyEvaluation;
export declare function defaultDevPolicy(agentId: string): AgentPolicyConfig;
export type { GuardStateStore, ReceiptStore, PersistedPaymentReceipt, PaymentAuthorization } from "./storage.js";
export { InMemoryGuardStateStore, evaluatePolicyRules } from "./storage.js";
export { PostgresGuardStateStore, type GuardSqlExecutor } from "./postgresStore.js";
export { authorizePayment } from "./authorize.js";
export { evaluateAgentPolicyWithStore } from "./evaluateWithStore.js";
