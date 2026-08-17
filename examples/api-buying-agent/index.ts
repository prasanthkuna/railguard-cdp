/** API buying agent — authorize via v5 API (fetch-only) */
const baseUrl = process.env.RAILGUARD_BASE_URL ?? "http://localhost:4000"
const token = process.env.RAILGUARD_ACCESS_TOKEN ?? ""

const create = await fetch(`${baseUrl}/v1/intents`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({
    principal: { organizationId: "org_demo", actorId: "api-buyer", actorType: "agent" },
    action: { type: "purchase", purpose: "paid API call" },
    counterparty: { domain: "data.vendor.io" },
    value: { amount: "50000", asset: "USDC" },
    constraints: { expiresAt: new Date(Date.now() + 300_000).toISOString() },
    idempotencyKey: `api_${Date.now()}`,
  }),
})

console.log(await create.text())
