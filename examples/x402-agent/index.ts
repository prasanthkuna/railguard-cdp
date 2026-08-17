/** x402 micro-payment agent example (v5) — fetch-only for encore compatibility */
const baseUrl = process.env.RAILGUARD_BASE_URL ?? "http://localhost:4000"
const token = process.env.RAILGUARD_ACCESS_TOKEN ?? ""

const body = {
  principal: { organizationId: "org_demo", actorId: "research-bot-3", actorType: "agent" },
  action: { type: "purchase", purpose: "competitor research" },
  counterparty: { domain: "api.example.com" },
  value: { amount: "3200000", asset: "USDC" },
  constraints: { expiresAt: new Date(Date.now() + 3600_000).toISOString(), network: "base-sepolia" },
  context: { task: "competitor research", resource: "https://api.example.com/v1/report" },
  idempotencyKey: `x402_${Date.now()}`,
}

const res = await fetch(`${baseUrl}/v1/intents`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
})

console.log(await res.text())
