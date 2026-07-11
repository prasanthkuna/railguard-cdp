import { APIError } from "encore.dev/api"

export type PaymentExecutionMode = "demo" | "live"

function readPaymentMode(): PaymentExecutionMode {
  const raw = process.env.PAYMENT_MODE?.trim().toLowerCase()
  if (raw !== "demo" && raw !== "live") {
    throw new Error(
      "PAYMENT_MODE must be explicitly set to 'demo' or 'live' before the API starts",
    )
  }
  return raw
}

/** Fail-closed: no implicit demo mode when PAYMENT_MODE is unset. */
export const PAYMENT_MODE: PaymentExecutionMode = readPaymentMode()

export function assertPaymentModeConfigured(): void {
  // Module load already enforced; exposed for tests and encore check imports.
  if (PAYMENT_MODE !== "demo" && PAYMENT_MODE !== "live") {
    throw APIError.failedPrecondition("PAYMENT_MODE must be demo or live")
  }
}

assertPaymentModeConfigured()
