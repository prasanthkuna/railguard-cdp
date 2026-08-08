import { APIError } from "encore.dev/api"
import { secret } from "encore.dev/config"

export type PaymentExecutionMode = "demo" | "live"

const paymentModeSecret = secret("PAYMENT_MODE")

let cachedPaymentMode: PaymentExecutionMode | undefined

/** Fail-closed at execution time; lazy so `encore check` can load the module without PAYMENT_MODE. */
export function resolvePaymentMode(): PaymentExecutionMode {
  if (cachedPaymentMode) return cachedPaymentMode
  let fromSecret = ""
  try {
    fromSecret = paymentModeSecret()?.trim() ?? ""
  } catch {
    fromSecret = ""
  }
  const raw = (fromSecret || process.env.PAYMENT_MODE?.trim() || "").toLowerCase()
  if (raw !== "demo" && raw !== "live") {
    throw APIError.failedPrecondition(
      "PAYMENT_MODE must be explicitly set to 'demo' or 'live' before executing payments",
    )
  }
  cachedPaymentMode = raw
  return cachedPaymentMode
}

export function assertPaymentModeConfigured(): void {
  resolvePaymentMode()
}

/** @internal test helper */
export function resetPaymentModeCacheForTests(): void {
  cachedPaymentMode = undefined
}

export { resolveCdpConfirmationDepth } from "./runtimeConfig"
