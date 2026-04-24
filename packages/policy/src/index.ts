export type PolicyResult = "allow" | "block" | "escalate"

export interface PolicyWallet {
  chain: string
  address: string
  status: "pending" | "approved" | "blocked"
}

export interface PolicyInvoiceInput {
  vendorStatus: "pending" | "approved" | "blocked"
  vendorRiskScore: number
  approvedWallets: PolicyWallet[]
  invoiceNumber?: string
  invoiceHash: string
  duplicateInvoiceID?: string
  amountBaseUnits: string
  token: string
  chain: string
  walletAddress: string
  extractionConfidence: number
  walletConfidence?: number
  walletRiskScore?: number
  supportedToken: string
  supportedChain: string
  reviewThresholdBaseUnits: bigint
  hardCapBaseUnits: bigint
  vendorAverageBaseUnits?: bigint
  amountReviewMultiplier?: number
  walletRiskThreshold?: number
}

export interface PolicyEvaluation {
  result: PolicyResult
  triggeredRules: string[]
  evidence: Record<string, unknown>
}

export function evaluateInvoicePolicy(input: PolicyInvoiceInput): PolicyEvaluation {
  const amount = BigInt(input.amountBaseUnits)
  const normalizedToken = normalize(input.token)
  const normalizedChain = normalize(input.chain)
  const approvedWallets = input.approvedWallets.filter((wallet) => wallet.status === "approved")
  const amountReviewMultiplier = input.amountReviewMultiplier ?? 3
  const walletRiskThreshold = input.walletRiskThreshold ?? 80
  const rules: string[] = []
  const escalations: string[] = []

  if (input.vendorStatus === "blocked") rules.push("vendor.blocked")
  if (input.vendorRiskScore >= 80) rules.push("vendor.risk_score_block")
  if (normalizedToken !== normalize(input.supportedToken)) rules.push("invoice.unsupported_token")
  if (normalizedChain !== normalize(input.supportedChain)) rules.push("invoice.unsupported_chain")
  if (!isAddress(input.walletAddress)) rules.push("wallet.invalid_address")
  if (amount > input.hardCapBaseUnits) rules.push("amount.hard_cap")
  if (input.duplicateInvoiceID) rules.push("invoice.duplicate")
  if ((input.walletRiskScore ?? 0) >= walletRiskThreshold) rules.push("wallet.risk_score_block")

  const exactWallet = approvedWallets.find(
    (wallet) =>
      normalize(wallet.chain) === normalizedChain &&
      wallet.address.toLowerCase() === input.walletAddress.toLowerCase(),
  )

  if (!exactWallet && approvedWallets.length > 0) rules.push("wallet.changed")
  if (!exactWallet && approvedWallets.length === 0) rules.push("wallet.no_approved_wallet")
  if (input.vendorStatus === "pending") escalations.push("vendor.pending_onboarding")
  if (!input.invoiceNumber) escalations.push("invoice.missing_number")
  if (input.extractionConfidence < 0.8) escalations.push("invoice.low_extraction_confidence")
  if ((input.walletConfidence ?? 1) < 0.95) escalations.push("wallet.low_extraction_confidence")
  if (amount > input.reviewThresholdBaseUnits) escalations.push("amount.requires_review")
  if (
    input.vendorAverageBaseUnits &&
    input.vendorAverageBaseUnits > 0n &&
    amount * 100n >
      BigInt(Math.round(Number(input.vendorAverageBaseUnits) * amountReviewMultiplier * 100))
  ) {
    escalations.push("amount.vendor_average_spike")
  }

  return {
    result: rules.length > 0 ? "block" : escalations.length > 0 ? "escalate" : "allow",
    triggeredRules: [...rules, ...escalations],
    evidence: {
      vendorStatus: input.vendorStatus,
      approvedWalletCount: approvedWallets.length,
      duplicateInvoiceID: input.duplicateInvoiceID,
      vendorAverageBaseUnits: input.vendorAverageBaseUnits?.toString(),
      walletRiskScore: input.walletRiskScore,
    },
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}
