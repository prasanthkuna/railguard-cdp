import type { PolicyDecision } from "../../core/dist/index.js";
import type { AuthorizePaymentInput, AuthorizePaymentResult, GuardStateStore } from "./storage.js";
export declare function authorizePayment(store: GuardStateStore, input: AuthorizePaymentInput): Promise<AuthorizePaymentResult & {
    decision?: PolicyDecision;
    domain?: string;
}>;
