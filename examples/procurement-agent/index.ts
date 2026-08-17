/** AP2 mandate → FinancialIntent example (inline, no workspace import) */
const mandate = {
  mandateId: "mandate_proc_001",
  organizationId: "org_1",
  agentId: "procurement-bot",
  merchantDomain: "supplier.example.com",
  maxAmount: "3000000000",
  asset: "USDC",
  purpose: "Q3 hardware procurement",
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  idempotencyKey: "proc_001",
}

const intent = {
  id: "fin_proc_001",
  principal: {
    organizationId: mandate.organizationId,
    actorId: mandate.agentId,
    actorType: "agent",
  },
  action: { type: "purchase", purpose: mandate.purpose },
  counterparty: { domain: mandate.merchantDomain },
  value: { amount: mandate.maxAmount, asset: mandate.asset, maxAmount: mandate.maxAmount },
  constraints: { expiresAt: mandate.expiresAt },
  context: { mandateId: mandate.mandateId, protocol: "ap2" },
  idempotencyKey: mandate.idempotencyKey,
}

console.log(JSON.stringify(intent, null, 2))
