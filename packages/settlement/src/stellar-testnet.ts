/** Horizon-backed Stellar testnet payment verification (no mainnet). */

export const STELLAR_TESTNET_EVIDENCE_TX =
  "3dc3225844f711f9f96ead65690d224b7ccfd616d1da5387df6bfc63bfb8e437"

export interface StellarPaymentFacts {
  hash: string
  successful: boolean
  source: string
  destination: string
  assetType: string
  assetCode?: string
  amount: string
  memo?: string
}

export interface StellarVerifyInput {
  txHash: string
  horizonUrl?: string
  expectedDestination?: string
  expectedAmount?: string
  expectedMemo?: string
}

export interface StellarVerifyResult {
  status: "CONFIRMED" | "RECONCILIATION_REQUIRED" | "FAILED"
  facts?: StellarPaymentFacts
  reason?: string
}

export async function fetchStellarPaymentFacts(
  txHash: string,
  horizonUrl = "https://horizon-testnet.stellar.org",
): Promise<StellarPaymentFacts> {
  const res = await fetch(`${horizonUrl}/transactions/${txHash}/operations?limit=10`)
  if (!res.ok) {
    throw new Error(`horizon_http_${res.status}`)
  }
  const json = (await res.json()) as {
    _embedded?: { records?: Array<Record<string, unknown>> }
  }
  const txRes = await fetch(`${horizonUrl}/transactions/${txHash}`)
  if (!txRes.ok) {
    throw new Error(`horizon_tx_${txRes.status}`)
  }
  const tx = (await txRes.json()) as { successful?: boolean; memo?: string }
  const payment = json._embedded?.records?.find((r) => r.type === "payment") as
    | {
        from: string
        to: string
        asset_type: string
        asset_code?: string
        amount: string
      }
    | undefined
  if (!payment) {
    throw new Error("no_payment_operation")
  }
  return {
    hash: txHash,
    successful: tx.successful === true,
    source: payment.from,
    destination: payment.to,
    assetType: payment.asset_type,
    assetCode: payment.asset_code,
    amount: payment.amount,
    memo: typeof tx.memo === "string" ? tx.memo : undefined,
  }
}

export async function verifyStellarTestnetPayment(
  input: StellarVerifyInput,
): Promise<StellarVerifyResult> {
  const facts = await fetchStellarPaymentFacts(input.txHash, input.horizonUrl)
  if (!facts.successful) {
    return { status: "FAILED", facts, reason: "transaction_not_successful" }
  }
  if (input.expectedDestination && facts.destination !== input.expectedDestination) {
    return { status: "RECONCILIATION_REQUIRED", facts, reason: "destination_mismatch" }
  }
  if (input.expectedAmount && facts.amount !== input.expectedAmount) {
    return { status: "RECONCILIATION_REQUIRED", facts, reason: "amount_mismatch" }
  }
  if (input.expectedMemo && facts.memo) {
    const ok = facts.memo === input.expectedMemo || facts.memo.startsWith(`${input.expectedMemo}:`)
    if (!ok) {
      return { status: "RECONCILIATION_REQUIRED", facts, reason: "memo_mismatch" }
    }
  }
  return { status: "CONFIRMED", facts }
}
