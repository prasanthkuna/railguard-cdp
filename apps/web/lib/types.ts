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
export type PolicyResult = "allow" | "escalate" | "block"

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

export interface UserRecord {
  id: string
  organizationID: string
  email: string
  workosUserID?: string
  role: "owner" | "finance" | "approver" | "viewer"
  createdAt: string
}

export interface Vendor {
  id: string
  organizationID: string
  name: string
  status: VendorStatus
  riskScore: number
  createdAt: string
}

export interface VendorWallet {
  id: string
  vendorID: string
  chain: string
  address: string
  status: VendorStatus
  firstSeenAt: string
  approvedAt?: string
  approvedBy?: string
}

export interface Invoice {
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

export interface PolicyRun {
  id: string
  invoiceID: string
  result: PolicyResult
  triggeredRules: string[]
  evidence: Record<string, unknown>
  createdAt: string
}

export interface ApprovalRecord {
  id: string
  invoiceID: string
  requiredRole: string
  approverUserID: string
  decision: "approved" | "rejected"
  reason?: string
  createdAt: string
}

export interface PaymentIntent {
  id: string
  invoiceID: string
  chain: string
  tokenAddress: string
  recipientAddress: string
  amountBaseUnits: string
  payload: Record<string, unknown>
  status: PaymentIntentStatus
  idempotencyKey: string
  txHash?: string
  createdAt: string
}

export interface AuditEvent {
  id: string
  entityType: string
  entityID: string
  actorType: string
  actorID: string
  eventType: string
  event: Record<string, unknown>
  previousHash?: string
  eventHash: string
  createdAt: string
}

export interface InvoiceUploadRecord {
  id: string
  organizationID: string
  invoiceID?: string
  objectKey: string
  fileName: string
  contentType: string
  sizeBytes: number
  sha256Hash: string
  scanStatus: string
  extractionStatus: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface AuditExportRecord {
  id: string
  organizationID: string
  entityType: string
  entityID?: string
  format: "csv" | "pdf"
  status: "queued" | "processing" | "completed" | "failed"
  objectKey?: string
  requestedBy: string
  errorMessage?: string
  createdAt: string
  completedAt?: string
}

export interface AuthURLResponse {
  url: string
  state: string
  codeVerifier: string
}

export interface AuthExchangeResponse {
  accessToken: string
  refreshToken: string
  sealedSession?: string
  organizationID?: string
  userID: string
  email: string
}

export interface DashboardResponse {
  pendingReview: number
  blocked: number
  needsApproval: number
  readyToPay: number
  totalProtectedBaseUnits: string
  riskEventsDetected: number
}

export interface InvoiceDetailResponse {
  invoice: Invoice
  policyRun?: PolicyRun
  approvals: ApprovalRecord[]
  uploads: InvoiceUploadRecord[]
  paymentIntents: PaymentIntent[]
  auditEvents: AuditEvent[]
}

export interface VendorDetailResponse {
  vendor: Vendor
  wallets: VendorWallet[]
  onboardingChecklist: string[]
  auditEvents: AuditEvent[]
}

export interface UploadInvoiceRequest {
  fileName: string
  contentType: string
  contentBase64: string
  vendorID?: string
  vendorNameHint?: string
  invoiceNumberHint?: string
  amountBaseUnitsHint?: string
  tokenHint?: string
  chainHint?: string
  walletAddressHint?: string
  paymentMemoHint?: string
}

export interface CreateVendorRequest {
  name: string
  status?: VendorStatus
  riskScore?: number
}

export interface AddWalletRequest {
  vendorID: string
  chain: string
  address: string
  status?: VendorStatus
}
