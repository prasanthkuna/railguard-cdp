import { randomUUID } from "node:crypto"
import type { Fulfilment } from "@railguard/kernel/domain"
import { db } from "./db"
import { enqueueOutboxEvent } from "./outboxService"

export async function recordFulfilment(input: {
  purchaseId: string
  merchantId: string
  fulfilmentId: string
  paymentIdentifier: string
  settlementReceipt?: string
  resultJson?: Record<string, unknown>
}): Promise<Fulfilment> {
  const existing = await db.queryRow<{
    id: string
    purchase_id: string
    merchant_id: string
    fulfilment_id: string
    payment_identifier: string
    settlement_receipt: string | null
    status: Fulfilment["status"]
    result_json: Record<string, unknown> | null
  }>`
    SELECT * FROM fulfilments
    WHERE merchant_id = ${input.merchantId} AND fulfilment_id = ${input.fulfilmentId}
  `
  if (existing) {
    return mapFulfilment(existing)
  }

  const id = `ful_${randomUUID()}`
  await db.exec`
    INSERT INTO fulfilments (
      id, purchase_id, merchant_id, fulfilment_id, payment_identifier,
      settlement_receipt, status, result_json
    ) VALUES (
      ${id}, ${input.purchaseId}, ${input.merchantId}, ${input.fulfilmentId},
      ${input.paymentIdentifier}, ${input.settlementReceipt ?? null}, 'COMPLETED',
      ${input.resultJson ? JSON.stringify(input.resultJson) : null}
    )
  `

  await db.exec`
    UPDATE purchases SET status = 'FULFILLED', updated_at = NOW()
    WHERE id = ${input.purchaseId}
  `

  await enqueueOutboxEvent({
    aggregateType: "fulfilment",
    aggregateId: id,
    eventType: "fulfilment.completed",
    payload: {
      purchaseId: input.purchaseId,
      merchantId: input.merchantId,
      fulfilmentId: input.fulfilmentId,
    },
  })

  return {
    id,
    purchaseId: input.purchaseId,
    merchantId: input.merchantId,
    fulfilmentId: input.fulfilmentId,
    paymentIdentifier: input.paymentIdentifier,
    settlementReceipt: input.settlementReceipt,
    status: "COMPLETED",
    resultJson: input.resultJson,
  }
}

function mapFulfilment(row: {
  id: string
  purchase_id: string
  merchant_id: string
  fulfilment_id: string
  payment_identifier: string
  settlement_receipt: string | null
  status: Fulfilment["status"]
  result_json: Record<string, unknown> | null
}): Fulfilment {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    merchantId: row.merchant_id,
    fulfilmentId: row.fulfilment_id,
    paymentIdentifier: row.payment_identifier,
    settlementReceipt: row.settlement_receipt ?? undefined,
    status: row.status,
    resultJson: row.result_json ?? undefined,
  }
}
