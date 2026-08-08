import { canonicalizeResource } from "../../core/dist/index.js";
export function evaluatePolicyRules(ctx, policy) {
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
    if (policy.allowedAssets?.length && !policy.allowedAssets.map((a) => a.toLowerCase()).includes(ctx.asset.toLowerCase())) {
        rules.push("asset.not_allowlisted");
    }
    if (policy.allowedNetworks?.length && !policy.allowedNetworks.includes(ctx.network)) {
        rules.push("network.not_allowlisted");
    }
    if (policy.requireMandateAboveAtomic !== undefined &&
        ctx.amountAtomic > policy.requireMandateAboveAtomic &&
        !ctx.mandateId) {
        escalations.push("mandate.required");
    }
    return { rules, escalations, domain };
}
/** Process-local dev/test store. Production must use a transactional Postgres implementation. */
export class InMemoryGuardStateStore {
    replays = new Map();
    spends = [];
    reservations = new Map();
    lock = Promise.resolve();
    async withLock(fn) {
        let release;
        const next = new Promise((resolve) => {
            release = resolve;
        });
        const prev = this.lock;
        this.lock = prev.then(() => next);
        await prev;
        try {
            return await fn();
        }
        finally {
            release();
        }
    }
    async claimReplay(fingerprint, ttlMs, nowMs = Date.now()) {
        return this.withLock(() => {
            const expiresAt = this.replays.get(fingerprint);
            if (expiresAt !== undefined && expiresAt > nowMs) {
                return false;
            }
            this.replays.set(fingerprint, nowMs + ttlMs);
            return true;
        });
    }
    async reserveBudget(agentId, amountAtomic, windows, authorizationId, nowMs = Date.now()) {
        return this.withLock(() => {
            for (const window of windows) {
                const spent = this.sumInWindowLocked(agentId, window.windowSeconds, nowMs);
                const reserved = this.reservedInWindowLocked(agentId, window.windowSeconds, nowMs);
                if (spent + reserved + amountAtomic > window.maxAmountAtomic) {
                    return false;
                }
            }
            this.reservations.set(authorizationId, {
                agentId,
                amountAtomic,
                atMs: nowMs,
                status: "reserved",
            });
            return true;
        });
    }
    async commitAuthorization(authorizationId, agentId, amountAtomic, nowMs = Date.now()) {
        await this.withLock(() => {
            const reservation = this.reservations.get(authorizationId);
            if (!reservation || reservation.status !== "reserved") {
                throw new Error(`authorization not reserved: ${authorizationId}`);
            }
            if (reservation.agentId !== agentId || reservation.amountAtomic !== amountAtomic) {
                throw new Error("authorization facts mismatch");
            }
            reservation.status = "committed";
            this.spends.push({ agentId, amountAtomic, atMs: nowMs });
        });
    }
    async releaseAuthorization(authorizationId) {
        await this.withLock(() => {
            const reservation = this.reservations.get(authorizationId);
            if (!reservation || reservation.status !== "reserved") {
                return;
            }
            reservation.status = "released";
        });
    }
    async sumSpendInWindow(agentId, windowSeconds, nowMs = Date.now()) {
        return this.withLock(() => this.sumInWindowLocked(agentId, windowSeconds, nowMs));
    }
    sumInWindowLocked(agentId, windowSeconds, nowMs) {
        const cutoff = nowMs - windowSeconds * 1000;
        return this.spends
            .filter((entry) => entry.agentId === agentId && entry.atMs >= cutoff)
            .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
    }
    reservedInWindowLocked(agentId, windowSeconds, nowMs) {
        const cutoff = nowMs - windowSeconds * 1000;
        return [...this.reservations.values()]
            .filter((entry) => entry.agentId === agentId &&
            entry.status === "reserved" &&
            entry.atMs >= cutoff)
            .reduce((sum, entry) => sum + entry.amountAtomic, 0n);
    }
}
