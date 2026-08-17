import { describe, expect, test } from "bun:test"
import { createCdpExecutionRail } from "./adapters/cdpRail"
import { createX402ExecutionRail } from "./adapters/x402Rail"
import { createBaseExecutionRail } from "./adapters/baseRail"
import { mandateToFinancialIntent } from "./adapters/mandates/ap2"
import { canReserveWithinLimits } from "./budget"
import { buildEvidenceEnvelope, explainCharge } from "./evidence"
import { createFinancialIntent, isAuthoritySubset } from "./intent"
import { authorizeIntent, executeIntent } from "./v5Actions"
import { handleAmbiguousExecution, mapLegacyPaymentStatus, requiresReconciliation } from "./executionRail"
import { determineSettlement } from "./reconciler"

describe("v5 kernel", () => {
  test("FinancialIntent is rail-agnostic", () => {
    const intent = createFinancialIntent(
      {
        principal: { organizationId: "org_1", actorId: "agent_1", actorType: "agent" },
        action: { type: "pay", purpose: "vendor invoice" },
        counterparty: { address: "0xabc" },
        value: { amount: "1000000", asset: "USDC" },
        constraints: { expiresAt: new Date(Date.now() + 3600_000).toISOString(), network: "base-sepolia" },
        idempotencyKey: "idem_1",
      },
      "intent_1",
    )
    expect(intent.id).toBe("intent_1")
    expect(intent.value.asset).toBe("USDC")
  })

  test("child authority subset", () => {
    expect(
      isAuthoritySubset(
        { amount: "500", asset: "USDC", network: "base" },
        { amount: "1000", asset: "USDC", network: "base" },
      ),
    ).toBe(true)
  })

  test("UNKNOWN maps from legacy status", () => {
    expect(mapLegacyPaymentStatus("unknown")).toBe("UNKNOWN")
    expect(requiresReconciliation("UNKNOWN")).toBe(true)
  })

  test("ambiguous execution triggers freeze path", () => {
    const recovery = handleAmbiguousExecution("grant_1")
    expect(recovery.grantAction).toBe("freeze")
    expect(recovery.reconciliation).toBe("enqueue")
  })

  test("budget reservation respects limits", () => {
    expect(
      canReserveWithinLimits("100", { perTransaction: "50" }, {}),
    ).toBe(false)
  })

  test("reconciler determines settlement", () => {
    expect(
      determineSettlement([
        { executionId: "e1", settlementStatus: "FINALIZED", observedAt: new Date().toISOString() },
      ]),
    ).toBe("SETTLED")
  })

  test("evidence envelope explain charge", () => {
    const envelope = buildEvidenceEnvelope({
      intent: { id: "i1" },
      policyDecision: { allow: true },
      authorizationGrant: { grantId: "g1" },
      execution: { provider: "cdp" },
      settlement: { status: "FINALIZED" },
      policyVersion: "v1",
      sequence: 1,
    })
    const explain = explainCharge(envelope, {
      agent: "agent_1",
      requested: "10 USDC",
      decision: "ALLOW",
    })
    expect(explain.evidenceValid).toBe(true)
  })

  test("authorize and execute via rails", async () => {
    const intent = createFinancialIntent(
      {
        principal: { organizationId: "org_1", actorId: "agent_1", actorType: "agent" },
        action: { type: "pay" },
        counterparty: { address: "0xabc" },
        value: { amount: "100", asset: "USDC" },
        constraints: { expiresAt: new Date(Date.now() + 3600_000).toISOString() },
        idempotencyKey: "idem_2",
      },
      "intent_2",
    )
    const grant = {
      grantId: "grant_1",
      intentId: intent.id,
      decision: "allow" as const,
      limits: { reservedAmount: "100", asset: "USDC" },
      policyVersion: "v1",
      validUntil: new Date(Date.now() + 3600_000).toISOString(),
      executionConstraints: {},
      evidenceHash: "abc",
    }
    const auth = await authorizeIntent(intent, async () => grant)
    expect(auth.status).toBe("AUTHORIZED")
    const cdp = createCdpExecutionRail({ organizationId: "org_1", payerAddress: "0xpayer" })
    const exec = await executeIntent(intent, grant, cdp)
    expect(exec.status).toBe("UNKNOWN")
    const x402 = createX402ExecutionRail()
    const exec2 = await executeIntent(intent, grant, x402)
    expect(exec2.status).toBe("SUBMITTED")
  })

  test("base rail aliases cdp", () => {
    const rail = createBaseExecutionRail({ organizationId: "org_1", payerAddress: "0xpayer" })
    expect(rail.name).toBe("base")
  })

  test("ap2 mandate normalizes to FinancialIntent", () => {
    const intent = mandateToFinancialIntent(
      {
        mandateId: "m1",
        organizationId: "org_1",
        agentId: "agent_1",
        merchantDomain: "shop.example",
        maxAmount: "100",
        asset: "USDC",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        idempotencyKey: "idem_ap2",
      },
      "fin_ap2",
    )
    expect(intent.context?.protocol).toBe("ap2")
  })
})
