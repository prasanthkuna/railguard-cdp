import { APIError } from "encore.dev/api"

export type PaymentExecutionMode = "demo" | "live"

let cachedPaymentMode: PaymentExecutionMode | undefined

/** Fail-closed at execution time; lazy so `encore check` can load the module without PAYMENT_MODE. */
export function resolvePaymentMode(): PaymentExecutionMode {
  if (cachedPaymentMode) return cachedPaymentMode
  const raw = process.env.PAYMENT_MODE?.trim().toLowerCase()
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

export { resolveCdpConfirmationDepth } from "./runtimeConfig"
