import type { X402PaymentContext, X402ResourceRef } from "./index.js";
export declare class InvalidPaymentContextError extends Error {
    constructor(message: string);
}
export declare function canonicalizeResource(resource: X402ResourceRef): X402ResourceRef;
export declare function validatePaymentContext(ctx: X402PaymentContext): X402PaymentContext;
