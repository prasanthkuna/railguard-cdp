import { validatePaymentContext } from "../../core/dist/index.js";
import { authorizePayment, buildPaymentFingerprint, InMemoryGuardStateStore, } from "../../policy/dist/index.js";
import { ReceiptLedger } from "../../receipts/dist/index.js";
export class PolicyViolationError extends Error {
    decision;
    receipt;
    constructor(message, decision, receipt) {
        super(message);
        this.decision = decision;
        this.receipt = receipt;
        this.name = "PolicyViolationError";
    }
}
export class ReplayDetectedError extends Error {
    fingerprint;
    receipt;
    constructor(fingerprint, receipt) {
        super(`Replay detected for fingerprint: ${fingerprint}`);
        this.fingerprint = fingerprint;
        this.receipt = receipt;
        this.name = "ReplayDetectedError";
    }
}
/**
 * Wraps an x402 payment callback with fail-closed policy, replay protection,
 * and tamper-evident receipts. Targets mark3labs/x402-go#26 pattern.
 */
export function withSpendingPolicy(callback, guard, toContext) {
    return async (amountAtomic, resourceUrl) => {
        const ctx = toContext(amountAtomic, resourceUrl);
        const decision = await guard.evaluate(ctx);
        if (decision.blocked) {
            throw new PolicyViolationError("Payment blocked by x402-guard policy", decision, guard.lastReceipt);
        }
        if (decision.decision === "escalate") {
            throw new PolicyViolationError("Payment requires human approval", decision, guard.lastReceipt);
        }
        if (callback) {
            const ok = await callback(amountAtomic, resourceUrl);
            if (ok) {
                await guard.commitAllowedSpend(ctx, decision.receiptId);
            }
            else if (decision.authorizationId) {
                await guard.releaseAuthorization(decision.authorizationId);
            }
            return ok;
        }
        await guard.commitAllowedSpend(ctx, decision.receiptId);
        return true;
    };
}
export class X402Guard {
    options;
    stateStore;
    ledger = new ReceiptLedger();
    authorizationByReceipt = new Map();
    receipts = [];
    lastReceipt;
    constructor(options) {
        this.options = options;
        this.stateStore = options.stateStore ?? new InMemoryGuardStateStore();
    }
    async releaseAuthorization(authorizationId) {
        await this.stateStore.releaseAuthorization(authorizationId);
    }
    /** Commits a reserved authorization after payment succeeds (M-08 / C-02). */
    async commitAllowedSpend(ctx, receiptId) {
        const normalized = validatePaymentContext(ctx);
        const pending = receiptId ? this.authorizationByReceipt.get(receiptId) : undefined;
        if (pending) {
            await this.stateStore.commitAuthorization(pending.authorizationId, pending.agentId, pending.amountAtomic);
            this.authorizationByReceipt.delete(receiptId);
            return;
        }
        if (this.stateStore.recordSpend) {
            await this.stateStore.recordSpend(normalized.agentId, normalized.amountAtomic);
        }
    }
    async evaluate(ctx) {
        const normalized = validatePaymentContext(ctx);
        const fingerprint = buildPaymentFingerprint(normalized);
        let auth = await authorizePayment(this.stateStore, {
            ctx: normalized,
            policy: this.options.policy,
            fingerprint,
            replayTtlMs: this.options.replayTtlMs ?? 300_000,
        });
        if (!auth.ok && auth.decision === "escalate" && this.options.onEscalate) {
            const approved = await this.options.onEscalate(normalized, auth.triggeredRules);
            if (approved) {
                auth = await authorizePayment(this.stateStore, {
                    ctx: normalized,
                    policy: this.options.policy,
                    fingerprint,
                    replayTtlMs: this.options.replayTtlMs ?? 300_000,
                });
            }
        }
        if (!auth.ok) {
            if (auth.triggeredRules.includes("replay.detected")) {
                const receipt = this.record(normalized, fingerprint, "block", auth.triggeredRules);
                throw new ReplayDetectedError(fingerprint, receipt);
            }
            const decision = auth.decision ?? "block";
            const receipt = this.record(normalized, fingerprint, decision, auth.triggeredRules);
            return {
                decision,
                triggeredRules: auth.triggeredRules,
                receiptId: receipt.receiptId,
                fingerprint,
                blocked: decision !== "allow",
            };
        }
        const receipt = this.record(normalized, fingerprint, "allow", []);
        this.authorizationByReceipt.set(receipt.receiptId, {
            authorizationId: auth.authorization.authorizationId,
            agentId: normalized.agentId,
            amountAtomic: normalized.amountAtomic,
        });
        return {
            decision: "allow",
            triggeredRules: [],
            receiptId: receipt.receiptId,
            fingerprint,
            blocked: false,
            authorizationId: auth.authorization.authorizationId,
        };
    }
    recordSettlement(receiptId, txHash) {
        const prior = this.receipts.find((entry) => entry.receiptId === receiptId);
        if (!prior || prior.decision !== "allow" || prior.txHash) {
            return undefined;
        }
        const settled = this.ledger.settle(prior, txHash);
        this.receipts.push(settled);
        if (this.lastReceipt?.receiptId === receiptId) {
            this.lastReceipt = settled;
        }
        return settled;
    }
    /** @deprecated Use recordSettlement(receiptId, txHash) */
    recordLastSettlement(txHash) {
        if (!this.lastReceipt)
            return undefined;
        return this.recordSettlement(this.lastReceipt.receiptId, txHash);
    }
    exportAuditJsonl() {
        return this.ledger.exportJsonl(this.receipts);
    }
    record(ctx, fingerprint, decision, triggeredRules) {
        const receipt = this.ledger.append({
            decision,
            triggeredRules,
            context: ctx,
            fingerprint,
            policyVersion: this.options.policyVersion ?? "v0.1.0",
        });
        this.receipts.push(receipt);
        this.lastReceipt = receipt;
        return receipt;
    }
}
export { defaultDevPolicy } from "../../policy/dist/index.js";
