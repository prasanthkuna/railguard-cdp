import { createHash } from "node:crypto"
import { stableStringify } from "../../packages/audit/src"
import type { InvoiceRecord as Invoice } from "../../packages/db/src"
import { BASE_SEPOLIA_CHAIN } from "../../packages/cdp/src"
import { evaluateInvoicePolicy } from "../../packages/policy/src"
import type { VendorRecord as Vendor, VendorWalletRecord as VendorWallet } from "../../packages/db/src"

const DEFAULT_APPROVAL_THRESHOLD = "100000000"
const DEFAULT_HARD_CAP = "1000000000"

export interface PolicySnapshotInput {
  invoice: Invoice
  vendor: Vendor
  approvedWallets: VendorWallet[]
  duplicateInvoiceID?: string
  vendorAverageBaseUnits: bigint
  workspace?: {
    allowedToken?: string
    allowedChain?: string
    approvalThresholdBaseUnits?: string
    hardCapBaseUnits?: string
    amountReviewMultiplier?: number
    walletRiskThreshold?: number
  }
}

export function buildPolicySnapshotInput(
  invoice: Invoice,
  vendor: Vendor,
  approvedWallets: VendorWallet[],
  duplicateInvoiceID: string | undefined,
  vendorAverageBaseUnits: bigint,
  workspace?: PolicySnapshotInput["workspace"],
): PolicySnapshotInput {
  return {
    invoice,
    vendor,
    approvedWallets: approvedWallets.map((wallet) => ({
      ...wallet,
    })),
    duplicateInvoiceID,
    vendorAverageBaseUnits,
    workspace,
  }
}

export function computePolicySnapshotHash(input: PolicySnapshotInput): string {
  const evaluation = evaluateInvoicePolicy({
    vendorStatus: input.vendor.status,
    vendorRiskScore: input.vendor.riskScore,
    approvedWallets: input.approvedWallets,
    invoiceNumber: input.invoice.invoiceNumber,
    invoiceHash: input.invoice.invoiceHash,
    duplicateInvoiceID: input.duplicateInvoiceID,
    amountBaseUnits: input.invoice.amountBaseUnits,
    token: input.invoice.token,
    chain: input.invoice.chain,
    walletAddress: input.invoice.walletAddress,
    extractionConfidence: input.invoice.extractionConfidence,
    walletConfidence: input.invoice.walletConfidence,
    walletRiskScore: input.vendor.riskScore,
    supportedToken: input.workspace?.allowedToken ?? "usdc",
    supportedChain: input.workspace?.allowedChain ?? BASE_SEPOLIA_CHAIN,
    reviewThresholdBaseUnits: BigInt(
      input.workspace?.approvalThresholdBaseUnits ?? DEFAULT_APPROVAL_THRESHOLD,
    ),
    hardCapBaseUnits: BigInt(input.workspace?.hardCapBaseUnits ?? DEFAULT_HARD_CAP),
    vendorAverageBaseUnits: input.vendorAverageBaseUnits,
    amountReviewMultiplier: input.workspace?.amountReviewMultiplier ?? 3,
    walletRiskThreshold: input.workspace?.walletRiskThreshold ?? 80,
  })

  const canonical = {
    invoiceID: input.invoice.id,
    invoiceHash: input.invoice.invoiceHash,
    amountBaseUnits: input.invoice.amountBaseUnits,
    token: input.invoice.token,
    chain: input.invoice.chain,
    walletAddress: input.invoice.walletAddress,
    vendorID: input.vendor.id,
    vendorStatus: input.vendor.status,
    vendorRiskScore: input.vendor.riskScore,
    approvedWalletAddresses: input.approvedWallets.map((wallet) => wallet.address).sort(),
    duplicateInvoiceID: input.duplicateInvoiceID ?? null,
    workspace: input.workspace ?? null,
    policyResult: evaluation.result,
    triggeredRules: [...evaluation.triggeredRules].sort(),
  }

  return createHash("sha256").update(stableStringify(canonical)).digest("hex")
}
