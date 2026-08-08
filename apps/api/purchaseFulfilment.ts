import { db } from "./db"
import { recordFulfilment } from "./fulfilmentService"

export async function completePurchaseFulfilmentForPaymentIntent(input: {
  purchaseId?: string | null
  paymentIntentId: string
  paymentIdentifier?: string | null
  txHash: string
}): Promise<void> {
  if (!input.purchaseId || !input.paymentIdentifier) {
    return
  }

  const purchase = await db.queryRow<{ merchant_id: string | null }>`
    SELECT merchant_id FROM purchases WHERE id = ${input.purchaseId}
  `
  const merchantId = purchase?.merchant_id ?? input.paymentIntentId

  await markPurchasePaidAndFulfil({
    purchaseId: input.purchaseId,
    merchantId,
    paymentIntentId: input.paymentIntentId,
    paymentIdentifier: input.paymentIdentifier,
    txHash: input.txHash,
  })
}

export async function markPurchasePaidAndFulfil(input: {
  purchaseId?: string | null
  merchantId: string
  paymentIntentId: string
  paymentIdentifier?: string | null
  txHash: string
}): Promise<void> {
  if (!input.purchaseId || !input.paymentIdentifier) {
    return
  }

  await db.exec`
    UPDATE purchases
    SET status = 'PAID', updated_at = NOW()
    WHERE id = ${input.purchaseId} AND status IN ('CREATED', 'QUOTED', 'APPROVED', 'PAID')
  `

  await recordFulfilment({
    purchaseId: input.purchaseId,
    merchantId: input.merchantId,
    fulfilmentId: input.paymentIntentId,
    paymentIdentifier: input.paymentIdentifier,
    settlementReceipt: input.txHash,
    resultJson: { paymentIntentId: input.paymentIntentId },
  })
}
