import { canonicalizeResource } from "../../core/dist/index.js";
export async function evaluateAgentPolicyWithStore(ctx, policy, store) {
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
    if (policy.allowedDomains.length > 0 && !policy.allowedDomains.includes(domain)) {
        rules.push("resource.unknown_domain");
    }
    if (policy.allowedPayees.length > 0 &&
        !policy.allowedPayees.some((p) => p.toLowerCase() === ctx.payTo.toLowerCase())) {
        rules.push("payee.not_allowlisted");
    }
    if (!policy.allowedAssets || policy.allowedAssets.length === 0) {
        // no asset constraint
    }
    else if (!policy.allowedAssets.map((a) => a.toLowerCase()).includes(ctx.asset.toLowerCase())) {
        rules.push("asset.not_allowlisted");
    }
    if (!policy.allowedNetworks || policy.allowedNetworks.length === 0) {
        // no network constraint
    }
    else if (!policy.allowedNetworks.includes(ctx.network)) {
        rules.push("network.not_allowlisted");
    }
    for (const window of policy.windows) {
        const spent = await store.sumSpendInWindow(ctx.agentId, window.windowSeconds);
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
