export type PolicyDecision = "allow" | "block" | "escalate";
export interface X402ResourceRef {
    method: string;
    url: string;
    domain: string;
    path: string;
}
export interface X402PaymentContext {
    agentId: string;
    payer: string;
    payTo: string;
    amountAtomic: bigint;
    asset: string;
    network: string;
    resource: X402ResourceRef;
    description?: string;
    reason?: string;
    mandateId?: string;
    idempotencyKey?: string;
}
export interface PolicyEvaluation {
    decision: PolicyDecision;
    triggeredRules: string[];
    evidence: Record<string, unknown>;
}
export interface SpendWindow {
    windowSeconds: number;
    maxAmountAtomic: bigint;
}
export interface AgentPolicyConfig {
    agentId: string;
    maxPerCallAtomic: bigint;
    allowedDomains: string[];
    blockedDomains: string[];
    allowedPayees: string[];
    allowedAssets?: string[];
    allowedNetworks?: string[];
    windows: SpendWindow[];
    requireMandateAboveAtomic?: bigint;
}
export interface GuardDecision {
    decision: PolicyDecision;
    triggeredRules: string[];
    receiptId: string;
    fingerprint: string;
    blocked: boolean;
    authorizationId?: string;
}
export declare function parseResourceUrl(url: string, method?: string): X402ResourceRef;
export declare function stableStringify(value: unknown): string;
export { InvalidPaymentContextError, canonicalizeResource, validatePaymentContext, } from "./validation.js";
