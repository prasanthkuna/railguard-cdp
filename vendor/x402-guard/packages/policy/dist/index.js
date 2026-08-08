import { canonicalizeResource } from "../../core/dist/index.js";
export class SpendTracker {
    records = [];
    record(agentId, amountAtomic, atMs = Date.now()) {
        if (amountAtomic <= 0n) {
            throw new Error("cannot record non-positive spend");
        }
        this.records.push({ agentId, amountAtomic, atMs });
    }
    sumInWindow(agentId, windowSeconds, nowMs = Date.now()) {
        const cutoff = nowMs - windowSeconds * 1000;
        return this.records
            .filter((r) => r.agentId === agentId && r.atMs >= cutoff)
            .reduce((sum, r) => sum + r.amountAtomic, 0n);
    }
}
export class ReplayGuard {
    ttlMs;
    seen = new Map();
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
    }
    check(fingerprint, nowMs = Date.now()) {
        const expiresAt = this.seen.get(fingerprint);
        if (expiresAt !== undefined && expiresAt > nowMs) {
            return true;
        }
        this.seen.set(fingerprint, nowMs + this.ttlMs);
        return false;
    }
}
export function buildPaymentFingerprint(ctx) {
    return [
        ctx.agentId,
        ctx.payer.toLowerCase(),
        ctx.payTo.toLowerCase(),
        ctx.amountAtomic.toString(),
        ctx.asset.toLowerCase(),
        ctx.network,
        ctx.resource.url,
        ctx.idempotencyKey ?? "",
    ].join("|");
}
export function evaluateAgentPolicy(ctx, policy, tracker) {
    const rules = [];
    const escalations = [];
    if (ctx.amountAtomic <= 0n) {
        rules.push("amount.non_positive");
    }
    let domain;
    try {
        domain = canonicalizeResource(ctx.resource).domain;
    }
    catch {
        rules.push("resource.invalid");
        domain = ctx.resource.domain;
    }
    if (ctx.agentId !== policy.agentId) {
        rules.push("agent.mismatch");
    }
    if (ctx.amountAtomic > policy.maxPerCallAtomic) {
        rules.push("amount.per_call_cap");
    }
    if (policy.blockedDomains.includes(domain)) {
        rules.push("resource.blocked_domain");
    }
    if (policy.allowedDomains.length > 0 &&
        !policy.allowedDomains.includes(domain)) {
        rules.push("resource.unknown_domain");
    }
    if (policy.allowedPayees.length > 0 &&
        !policy.allowedPayees.some((p) => p.toLowerCase() === ctx.payTo.toLowerCase())) {
        rules.push("payee.not_allowlisted");
    }
    if (policy.allowedAssets?.length && !policy.allowedAssets.map((a) => a.toLowerCase()).includes(ctx.asset.toLowerCase())) {
        rules.push("asset.not_allowlisted");
    }
    if (policy.allowedNetworks?.length && !policy.allowedNetworks.includes(ctx.network)) {
        rules.push("network.not_allowlisted");
    }
    for (const window of policy.windows) {
        const spent = tracker.sumInWindow(ctx.agentId, window.windowSeconds);
        if (spent + ctx.amountAtomic > window.maxAmountAtomic) {
            rules.push(`budget.window_${window.windowSeconds}s_exceeded`);
        }
    }
    if (policy.requireMandateAboveAtomic !== undefined &&
        ctx.amountAtomic > policy.requireMandateAboveAtomic &&
        !ctx.mandateId) {
        escalations.push("mandate.required");
    }
    const decision = rules.length > 0 ? "block" : escalations.length > 0 ? "escalate" : "allow";
    return {
        decision,
        triggeredRules: [...rules, ...escalations],
        evidence: {
            agentId: ctx.agentId,
            domain,
            amountAtomic: ctx.amountAtomic.toString(),
            mandateId: ctx.mandateId ?? null,
        },
    };
}
export function defaultDevPolicy(agentId) {
    return {
        agentId,
        maxPerCallAtomic: 1000000n,
        allowedDomains: [],
        blockedDomains: ["blocked.vendor"],
        allowedPayees: [],
        windows: [{ windowSeconds: 86_400, maxAmountAtomic: 10000000n }],
        requireMandateAboveAtomic: 500000n,
    };
}
export { InMemoryGuardStateStore, evaluatePolicyRules } from "./storage.js";
export { PostgresGuardStateStore } from "./postgresStore.js";
export { authorizePayment } from "./authorize.js";
export { evaluateAgentPolicyWithStore } from "./evaluateWithStore.js";
