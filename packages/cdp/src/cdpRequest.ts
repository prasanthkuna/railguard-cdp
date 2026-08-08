import { createHash } from "node:crypto"
export const BASE_SEPOLIA_CHAIN = "base-sepolia"

export const CDP_PROVIDER = "cdp" as const

export interface CanonicalCdpTransferRequest {
  provider: typeof CDP_PROVIDER
  organizationId: string
  paymentIntentId: string
  accountName: string
  to: string
  amount: string
  token: "usdc"
  network: typeof BASE_SEPOLIA_CHAIN
}

export function buildCanonicalCdpTransferRequest(input: {
  organizationId: string
  paymentIntentId: string
  recipientAddress: string
  amountBaseUnits: string
  chain?: string
}): CanonicalCdpTransferRequest {
  return {
    provider: CDP_PROVIDER,
    organizationId: input.organizationId,
    paymentIntentId: input.paymentIntentId,
    accountName: `railguard-${safeIdentifier(input.organizationId)}`,
    to: input.recipientAddress,
    amount: input.amountBaseUnits,
    token: "usdc",
    network: BASE_SEPOLIA_CHAIN,
  }
}

export function hashCanonicalCdpRequest(request: CanonicalCdpTransferRequest): string {
  return createHash("sha256").update(stableStringify(request)).digest("hex")
}

export function verifyCanonicalCdpRequest(
  stored: CanonicalCdpTransferRequest,
  storedHash: string,
  candidate: CanonicalCdpTransferRequest,
): boolean {
  return storedHash === hashCanonicalCdpRequest(candidate) && stableStringify(stored) === stableStringify(candidate)
}

function safeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}
