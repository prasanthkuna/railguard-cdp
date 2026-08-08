import type { AgentPolicyConfig, GuardDecision, X402PaymentContext } from "../../core/dist/index.js";
import { type PaymentReceipt } from "../../receipts/dist/index.js";
export declare class PolicyViolationError extends Error {
    readonly decision: GuardDecision;
    readonly receipt: PaymentReceipt;
    constructor(message: string, decision: GuardDecision, receipt: PaymentReceipt);
}
export declare class ReplayDetectedError extends Error {
    readonly fingerprint: string;
    readonly receipt?: PaymentReceipt | undefined;
    constructor(fingerprint: string, receipt?: PaymentReceipt | undefined);
}
export interface X402GuardOptions {
    policy: AgentPolicyConfig;
    policyVersion?: string;
    replayTtlMs?: number;
    stateStore?: import("../../policy/dist/index.js").GuardStateStore;
    onEscalate?: (ctx: X402PaymentContext, rules: string[]) => Promise<boolean>;
}
export type PaymentCallback = (amountAtomic: bigint, resourceUrl: string) => boolean | Promise<boolean>;
/**
 * Wraps an x402 payment callback with fail-closed policy, replay protection,
 * and tamper-evident receipts. Targets mark3labs/x402-go#26 pattern.
 */
export declare function withSpendingPolicy(callback: PaymentCallback | undefined, guard: X402Guard, toContext: (amountAtomic: bigint, resourceUrl: string) => X402PaymentContext): PaymentCallback;
export declare class X402Guard {
    private readonly options;
    private readonly stateStore;
    private readonly ledger;
    private readonly authorizationByReceipt;
    readonly receipts: PaymentReceipt[];
    lastReceipt: PaymentReceipt | undefined;
    constructor(options: X402GuardOptions);
    releaseAuthorization(authorizationId: string): Promise<void>;
    /** Commits a reserved authorization after payment succeeds (M-08 / C-02). */
    commitAllowedSpend(ctx: X402PaymentContext, receiptId?: string): Promise<void>;
    evaluate(ctx: X402PaymentContext): Promise<GuardDecision>;
    recordSettlement(receiptId: string, txHash: string): PaymentReceipt | undefined;
    /** @deprecated Use recordSettlement(receiptId, txHash) */
    recordLastSettlement(txHash: string): PaymentReceipt | undefined;
    exportAuditJsonl(): string;
    private record;
}
export type { AgentPolicyConfig, X402PaymentContext } from "../../core/dist/index.js";
export { defaultDevPolicy } from "../../policy/dist/index.js";
export type { PaymentReceipt } from "../../receipts/dist/index.js";
