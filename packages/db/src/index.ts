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
export type PaymentIntentStatus =
  | "prepared"
  | "executing"
  | "submitted"
  | "confirmed"
  | "reverted"
  | "unknown"
  | "reconciliation_required"
  | "executed"
  | "failed"

export type GuardLifecycleStatus = "reserved" | "committed" | "released" | "frozen"

export type SettlementLifecycleStatus =
  | "pending"
  | "confirmed"
  | "reverted"
  | "reconciliation_required"
export type ExtractionStatus = "queued" | "processing" | "completed" | "failed"
export type ScanStatus = "pending" | "clean" | "rejected"
export type AuditExportStatus = "queued" | "processing" | "completed" | "failed"

export interface TenantScopedRecord {
  organizationID: string
}

export interface OrganizationRecord {
  id: string
  name: string
  workosOrganizationID?: string
  approvalThresholdBaseUnits: string
  hardCapBaseUnits: string
  allowedToken: string
  allowedChain: string
  amountReviewMultiplier: number
  walletRiskThreshold: number
  createdAt: string
}

export interface UserRecord extends TenantScopedRecord {
  id: string
  email: string
  workosUserID?: string
  role: "owner" | "finance" | "approver" | "viewer"
  createdAt: string
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
  organizationID: string
  invoiceNumber?: string
  invoiceHash: string
  vendorNameRaw?: string
  amountBaseUnits: string
  amountDecimal: string
  token: string
  chain: string
  walletAddress: string
  extractionConfidence: number
  walletConfidence?: number
  invoiceDate?: string
  dueDate?: string
  paymentMemo?: string
  lineItemSummary?: string
  extractionModel?: string
  status: InvoiceStatus
  createdAt: string
}

export interface InvoiceUploadRecord extends TenantScopedRecord {
  id: string
  invoiceID?: string
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  sha256Hash: string
  scanStatus: ScanStatus
  extractionStatus: ExtractionStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AuditExportRecord extends TenantScopedRecord {
  id: string
  entityType: string
  entityID?: string
  format: "csv" | "pdf"
  status: AuditExportStatus
  objectKey?: string
  requestedBy: string
  errorMessage?: string
  createdAt: string
  completedAt?: string
}
