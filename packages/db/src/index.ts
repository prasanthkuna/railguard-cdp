export type VendorStatus = "pending" | "approved" | "blocked"
export type InvoiceStatus =
  | "received"
  | "ready"
  | "needs_approval"
  | "blocked"
  | "approved"
  | "rejected"
  | "payment_intent_created"
  | "executed"
export type PaymentIntentStatus = "prepared" | "executed" | "failed"

export interface TenantScopedRecord {
  organizationID: string
}

export interface VendorRecord extends TenantScopedRecord {
  id: string
  name: string
  status: VendorStatus
  riskScore: number
  createdAt: string
}

export interface VendorWalletRecord {
  id: string
  vendorID: string
  chain: string
  address: string
  status: VendorStatus
  firstSeenAt: string
  approvedAt?: string
  approvedBy?: string
}

export interface InvoiceRecord {
  id: string
  vendorID: string
  invoiceNumber?: string
  invoiceHash: string
  amountBaseUnits: string
  token: string
  chain: string
  walletAddress: string
  extractionConfidence: number
  status: InvoiceStatus
  createdAt: string
}
