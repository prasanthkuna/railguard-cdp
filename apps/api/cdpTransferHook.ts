import { type CdpExecutionResult } from "./providers.types"

export type CdpTransferHook = (input: {
  organizationID: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
  paymentIntentId: string
  idempotencyKey: string
  providerIdempotencyKey: string
}) => Promise<CdpExecutionResult | "DROP_RESPONSE">

let cdpTransferHook: CdpTransferHook | null = null

export function setCdpTransferHookForTests(hook: CdpTransferHook | null): void {
  cdpTransferHook = hook
}

export function getCdpTransferHook(): CdpTransferHook | null {
  return cdpTransferHook
}
