import type { AgentPolicyConfig, PolicyEvaluation, X402PaymentContext } from "../../core/dist/index.js";
import type { GuardStateStore } from "./storage.js";
export declare function evaluateAgentPolicyWithStore(ctx: X402PaymentContext, policy: AgentPolicyConfig, store: GuardStateStore): Promise<PolicyEvaluation>;
