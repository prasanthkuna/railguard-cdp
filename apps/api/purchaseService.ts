import { randomUUID } from "node:crypto"
import type { Purchase, Quote } from "@railguard/kernel/domain"
import { db } from "./db"
import { enqueueOutboxEvent } from "./outboxService"

export async function createPurchase(input: {
  organizationId: string
  businessIdempotencyKey: string
  merchantId?: string
}): Promise<Purchase> {
  const existing = await db.queryRow<{
    id: string
    organization_id: string
    business_idempotency_key: string
    merchant_id: string | null
    status: Purchase["status"]
    created_at: Date
  }>`
    SELECT * FROM purchases
    WHERE organization_id = ${input.organizationId}
      AND business_idempotency_key = ${input.businessIdempotencyKey}
  `
  if (existing) {
    return mapPurchase(existing)
  }

  const id = `pur_${randomUUID()}`
  await db.exec`
    INSERT INTO purchases (id, organization_id, business_idempotency_key, merchant_id, status)
    VALUES (${id}, ${input.organizationId}, ${input.businessIdempotencyKey}, ${input.merchantId ?? null}, 'CREATED')
  `
  await enqueueOutboxEvent({
    aggregateType: "purchase",
    aggregateId: id,
    eventType: "purchase.created",
    payload: { organizationId: input.organizationId, businessIdempotencyKey: input.businessIdempotencyKey },
  })

  const row = await db.queryRow<{
    id: string
    organization_id: string
    business_idempotency_key: string
    merchant_id: string | null
    status: Purchase["status"]
    created_at: Date
  }>`SELECT * FROM purchases WHERE id = ${id}`
  if (!row) throw new Error("purchase not created")
  return mapPurchase(row)
}

export async function addQuote(input: {
  purchaseId: string
  merchant: string
  resource: string
  method: string
  requestBodyHash: string
  network: string
  token: string
  recipient: string
  amount: string
  expiresAt: Date
}): Promise<Quote> {
  const versionRow = await db.queryRow<{ next_version: number }>`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM quotes WHERE purchase_id = ${input.purchaseId}
  `
  const version = versionRow?.next_version ?? 1
  const id = `quo_${randomUUID()}`

  await db.exec`
    UPDATE quotes SET status = 'SUPERSEDED'
    WHERE purchase_id = ${input.purchaseId} AND status = 'ACTIVE'
  `

  await db.exec`
    INSERT INTO quotes (
      id, purchase_id, version, merchant, resource, method, request_body_hash,
      network, token, recipient, amount, expires_at, status
    ) VALUES (
      ${id}, ${input.purchaseId}, ${version}, ${input.merchant}, ${input.resource},
      ${input.method}, ${input.requestBodyHash}, ${input.network}, ${input.token},
      ${input.recipient}, ${input.amount}, ${input.expiresAt}, 'ACTIVE'
    )
  `

  await db.exec`
    UPDATE purchases SET status = 'QUOTED', updated_at = NOW()
    WHERE id = ${input.purchaseId}
  `

  return {
    id,
    purchaseId: input.purchaseId,
    version,
    merchant: input.merchant,
    resource: input.resource,
    method: input.method,
    requestBodyHash: input.requestBodyHash,
    network: input.network,
    token: input.token,
    recipient: input.recipient,
    amount: input.amount,
    expiresAt: input.expiresAt.toISOString(),
    status: "ACTIVE",
  }
}

function mapPurchase(row: {
  id: string
  organization_id: string
  business_idempotency_key: string
  merchant_id: string | null
  status: Purchase["status"]
  created_at: Date
}): Purchase {
  return {
    id: row.id,
    organizationId: row.organization_id,
    businessIdempotencyKey: row.business_idempotency_key,
    merchantId: row.merchant_id ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  }
}
