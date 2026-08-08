import { createHash, randomUUID } from "node:crypto";
import { stableStringify } from "../../core/dist/index.js";
export class ReceiptLedger {
    lastHash;
    append(input) {
        const payload = {
            receiptVersion: "x402-guard.v1",
            receiptId: `rcpt_${randomUUID()}`,
            decision: input.decision,
            triggeredRules: input.triggeredRules,
            agentId: input.context.agentId,
            payer: input.context.payer,
            payTo: input.context.payTo,
            amountAtomic: input.context.amountAtomic.toString(),
            asset: input.context.asset,
            network: input.context.network,
            resourceUrl: input.context.resource.url,
            fingerprint: input.fingerprint,
            mandateId: input.context.mandateId,
            txHash: input.txHash,
            policyVersion: input.policyVersion,
            createdAt: new Date().toISOString(),
            previousHash: this.lastHash,
        };
        const receiptHash = createHash("sha256")
            .update(stableStringify(payload))
            .digest("hex");
        const receipt = { ...payload, receiptHash };
        this.lastHash = receiptHash;
        return receipt;
    }
    exportJsonl(receipts) {
        return receipts.map((r) => JSON.stringify(r)).join("\n");
    }
    /** Append settlement txHash as a new hash-chained receipt entry. */
    settle(previous, txHash) {
        const payload = {
            receiptVersion: "x402-guard.v1",
            receiptId: `rcpt_settle_${randomUUID()}`,
            decision: previous.decision,
            triggeredRules: previous.triggeredRules,
            agentId: previous.agentId,
            payer: previous.payer,
            payTo: previous.payTo,
            amountAtomic: previous.amountAtomic,
            asset: previous.asset,
            network: previous.network,
            resourceUrl: previous.resourceUrl,
            fingerprint: previous.fingerprint,
            mandateId: previous.mandateId,
            txHash,
            policyVersion: previous.policyVersion,
            createdAt: new Date().toISOString(),
            previousHash: previous.receiptHash,
        };
        const receiptHash = createHash("sha256")
            .update(stableStringify(payload))
            .digest("hex");
        const receipt = { ...payload, receiptHash };
        this.lastHash = receiptHash;
        return receipt;
    }
}
