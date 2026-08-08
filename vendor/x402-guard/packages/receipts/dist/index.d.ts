import { type PolicyDecision, type X402PaymentContext } from "../../core/dist/index.js";
export interface PaymentReceipt {
    receiptVersion: "x402-guard.v1";
    receiptId: string;
    decision: PolicyDecision;
    triggeredRules: string[];
    agentId: string;
    payer: string;
    payTo: string;
    amountAtomic: string;
    asset: string;
    network: string;
    resourceUrl: string;
    fingerprint: string;
    mandateId?: string;
    txHash?: string;
    policyVersion: string;
    createdAt: string;
    previousHash?: string;
    receiptHash: string;
}
export declare class ReceiptLedger {
    private lastHash;
    append(input: {
        decision: PolicyDecision;
        triggeredRules: string[];
        context: X402PaymentContext;
        fingerprint: string;
        policyVersion: string;
        txHash?: string;
    }): PaymentReceipt;
    exportJsonl(receipts: PaymentReceipt[]): string;
    /** Append settlement txHash as a new hash-chained receipt entry. */
    settle(previous: PaymentReceipt, txHash: string): PaymentReceipt;
}
