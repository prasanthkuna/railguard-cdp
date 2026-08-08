import { createHash } from "node:crypto"

export {
  CDP_PROVIDER,
  type CanonicalCdpTransferRequest,
  buildCanonicalCdpTransferRequest,
  hashCanonicalCdpRequest,
  verifyCanonicalCdpRequest,
} from "./cdpRequest"

export interface PaymentExecutionRequest {
  recipientAddress: string
  amountBaseUnits: string
  chain: string
}

export const BASE_SEPOLIA_CHAIN = "base-sepolia"
export const BASE_SEPOLIA_CHAIN_ID = 84532
export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

export interface DemoPaymentPayload extends PaymentExecutionRequest {
  tokenAddress: string
  invoiceID: string
}

export function buildDemoPaymentPayload(input: {
  invoiceID: string
  recipientAddress: string
  amountBaseUnits: string
  chain?: string
}): DemoPaymentPayload {
  return {
    invoiceID: input.invoiceID,
    recipientAddress: input.recipientAddress,
    amountBaseUnits: input.amountBaseUnits,
    chain: input.chain ?? BASE_SEPOLIA_CHAIN,
    tokenAddress: BASE_SEPOLIA_USDC,
  }
}

export function buildDemoTransactionHash(seed: string): string {
  return `0x${createHash("sha256").update(seed).digest("hex")}`
}
