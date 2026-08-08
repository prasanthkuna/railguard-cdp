import type { AgentPolicyConfig, SpendWindow, X402PaymentContext } from "../../core/dist/index.js";
export interface PaymentAuthorization {
    authorizationId: string;
}
export interface AuthorizePaymentInput {
    ctx: X402PaymentContext;
    policy: AgentPolicyConfig;
    fingerprint: string;
    replayTtlMs: number;
    nowMs?: number;
}
export type AuthorizePaymentResult = {
    ok: true;
    authorization: PaymentAuthorization;
} | {
    ok: false;
    triggeredRules: string[];
};
export interface GuardStateStore {
    /** Atomically claim replay fingerprint. Returns true when this caller owns the claim. */
    claimReplay(fingerprint: string, ttlMs: number, nowMs?: number): Promise<boolean>;
    /**
     * Atomically reserve budget across all policy windows under one authorization handle.
     * Returns null when any window would be exceeded.
     */
    reserveBudget(agentId: string, amountAtomic: bigint, windows: SpendWindow[], authorizationId: string, nowMs?: number): Promise<boolean>;
    commitAuthorization(authorizationId: string, agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
    releaseAuthorization(authorizationId: string): Promise<void>;
    /** @deprecated use claimReplay */
    hasReplay?(fingerprint: string, nowMs?: number): Promise<boolean>;
    /** @deprecated use claimReplay */
    markReplay?(fingerprint: string, ttlMs: number, nowMs?: number): Promise<void>;
    sumSpendInWindow(agentId: string, windowSeconds: number, nowMs?: number): Promise<bigint>;
    /** @deprecated use commitAuthorization */
    recordSpend?(agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
}
export declare function evaluatePolicyRules(ctx: X402PaymentContext, policy: AgentPolicyConfig): {
    rules: string[];
    escalations: string[];
    domain: string;
};
/** Process-local dev/test store. Production must use a transactional Postgres implementation. */
export declare class InMemoryGuardStateStore implements GuardStateStore {
    private readonly replays;
    private readonly spends;
    private readonly reservations;
    private lock;
    private withLock;
    claimReplay(fingerprint: string, ttlMs: number, nowMs?: number): Promise<boolean>;
    reserveBudget(agentId: string, amountAtomic: bigint, windows: SpendWindow[], authorizationId: string, nowMs?: number): Promise<boolean>;
    commitAuthorization(authorizationId: string, agentId: string, amountAtomic: bigint, nowMs?: number): Promise<void>;
    releaseAuthorization(authorizationId: string): Promise<void>;
    sumSpendInWindow(agentId: string, windowSeconds: number, nowMs?: number): Promise<bigint>;
    private sumInWindowLocked;
    private reservedInWindowLocked;
}
export interface PersistedPaymentReceipt {
    receiptId: string;
    decision: "allow" | "block" | "escalate";
    fingerprint: string;
    context: X402PaymentContext;
    txHash?: string;
}
export interface ReceiptStore {
    append(receipt: PersistedPaymentReceipt): Promise<void>;
    get(receiptId: string): Promise<PersistedPaymentReceipt | undefined>;
    settle(receiptId: string, txHash: string): Promise<PersistedPaymentReceipt | undefined>;
}
