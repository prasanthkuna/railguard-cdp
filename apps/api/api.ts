import { randomUUID } from "node:crypto"
import { APIError, type Query, api } from "encore.dev/api"
import { Subscription } from "encore.dev/pubsub"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { getAuthData } from "~encore/auth"
import { buildAuditHash, stableStringify } from "../../packages/audit/src"
import { type AppRole, type AuthenticatedActor, hasRequiredRole } from "../../packages/auth/src"
import {
  BASE_SEPOLIA_CHAIN,
  buildDemoPaymentPayload,
  buildDemoTransactionHash,
} from "../../packages/cdp/src"
import type {
  AuditExportRecord,
  AuditExportStatus,
  InvoiceRecord as Invoice,
  InvoiceStatus,
  InvoiceUploadRecord,
  OrganizationRecord,
  PaymentIntentStatus,
  ScanStatus,
  UserRecord,
  VendorRecord as Vendor,
  VendorStatus,
  VendorWalletRecord as VendorWallet,
} from "../../packages/db/src"
import { type PolicyResult, evaluateInvoicePolicy } from "../../packages/policy/src"
import { db } from "./db"
import {
  type AuditExportRequestedMessage,
  type ExtractionRequestedMessage,
  type NotificationRequestedMessage,
  auditExportRequestedTopic,
  auditExportsBucket,
  extractionRequestedTopic,
  invoiceDocumentsBucket,
  notificationRequestedTopic,
} from "./infrastructure"
import {
  createWorkOSOrganization,
  exchangeWorkOSCode,
  executeCdpTransfer,
  extractInvoiceDocument,
  fetchWorkOSOrganization,
  fetchWorkOSUser,
  getWorkOSAuthorizationURL,
  hasWorkOSConfig,
  rejectIfUnsafeDocument,
  sendApprovalNotification,
  sha256Buffer,
  verifyWorkOSWebhook,
} from "./providers"

interface PolicyRun {
  id: string
  invoiceID: string
  result: PolicyResult
  triggeredRules: string[]
  evidence: Record<string, unknown>
  createdAt: string
}

interface PaymentIntent {
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

interface AuditEvent {
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

interface WorkspaceSettings {
  approvalThresholdBaseUnits?: string
  hardCapBaseUnits?: string
  allowedToken?: string
  allowedChain?: string
  amountReviewMultiplier?: number
  walletRiskThreshold?: number
}

interface CreateWorkspaceRequest {
  name: string
  ownerEmail?: string
}

interface UpdateWorkspaceRequest extends WorkspaceSettings {}

interface CreateVendorRequest {
  name: string
  status?: VendorStatus
  riskScore?: number
}

interface AddWalletRequest {
  vendorID: string
  chain: string
  address: string
  status?: VendorStatus
}

interface UploadInvoiceRequest {
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

interface CreateInvoiceRequest {
  vendorID: string
  invoiceNumber?: string
  documentHash?: string
  amountBaseUnits: string
  token: string
  chain: string
  walletAddress: string
  extractionConfidence: number
  walletConfidence?: number
  vendorNameRaw?: string
  amountDecimal?: string
  invoiceDate?: string
  dueDate?: string
  paymentMemo?: string
  lineItemSummary?: string
}

interface ListInvoicesRequest {
  status?: Query<string>
}

interface DashboardResponse {
  pendingReview: number
  blocked: number
  needsApproval: number
  readyToPay: number
  totalProtectedBaseUnits: string
  riskEventsDetected: number
}

interface InvoiceDetailResponse {
  invoice: Invoice
  policyRun?: PolicyRun
  approvals: ApprovalRecord[]
  uploads: InvoiceUploadRecord[]
  paymentIntents: PaymentIntent[]
  auditEvents: AuditEvent[]
}

interface VendorDetailResponse {
  vendor: Vendor
  wallets: VendorWallet[]
  onboardingChecklist: string[]
  auditEvents: AuditEvent[]
}

interface ApprovalRequest {
  invoiceID: string
  decision: "approved" | "rejected"
  reason?: string
}

interface CreatePaymentIntentRequest {
  invoiceID: string
  idempotencyKey: string
}

interface ExecutePaymentIntentRequest {
  id: string
  idempotencyKey: string
}

interface PolicySimulationRequest extends WorkspaceSettings {
  invoiceID: string
}

interface AuditExportRequest {
  entityType: string
  entityID?: string
  format: "csv" | "pdf"
}

interface WorkOSAuthorizeRequest {
  redirectURI: string
  organizationID?: string
}

interface WorkOSExchangeRequest {
  code: string
  redirectURI: string
  codeVerifier?: string
}

interface ApprovalRecord {
  id: string
  invoiceID: string
  requiredRole: string
  approverUserID: string
  decision: "approved" | "rejected"
  reason?: string
  createdAt: string
}

interface SystemActor {
  organizationID: string
  actorType: "system" | "user"
  actorID: string
  email?: string
}

const DEFAULT_APPROVAL_THRESHOLD = "5000000000"
const DEFAULT_HARD_CAP = "100000000000"
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const SUPPORTED_CONTENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"])

export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<{ status: "ok"; service: string }> => ({
    status: "ok",
    service: "railguard-api",
  }),
)

export const getDashboard = api(
  { expose: true, auth: true, method: "GET", path: "/dashboard" },
  async (): Promise<DashboardResponse> => {
    const actor = await requireActor()
    const counts = await db.queryRow<{
      pending_review: number
      blocked: number
      needs_approval: number
      ready_to_pay: number
      total_protected: string | null
    }>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'received')::int AS pending_review,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status = 'needs_approval')::int AS needs_approval,
        COUNT(*) FILTER (WHERE status IN ('ready', 'approved', 'payment_intent_created'))::int AS ready_to_pay,
        COALESCE(SUM(amount_base_units) FILTER (WHERE status IN ('payment_intent_created', 'executed')), '0') AS total_protected
      FROM invoices
      WHERE organization_id = ${actor.organizationID}
    `
    const risks = await db.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM policy_runs
      WHERE organization_id = ${actor.organizationID} AND result <> 'allow'
    `

    return {
      pendingReview: counts?.pending_review ?? 0,
      blocked: counts?.blocked ?? 0,
      needsApproval: counts?.needs_approval ?? 0,
      readyToPay: counts?.ready_to_pay ?? 0,
      totalProtectedBaseUnits: counts?.total_protected ?? "0",
      riskEventsDetected: risks?.count ?? 0,
    }
  },
)

export const bootstrapWorkspace = api(
  { expose: true, method: "POST", path: "/workspace/bootstrap" },
  async (params: CreateWorkspaceRequest): Promise<{ workspace: OrganizationRecord }> => {
    const name = params.name.trim()
    if (!name) throw APIError.invalidArgument("workspace name is required")

    const workosOrganization = hasWorkOSConfig() ? await createWorkOSOrganization(name) : null
    const organizationID = workosOrganization?.id ?? id("org")
    const row = await db.queryRow<OrganizationRow>`
      INSERT INTO organizations (
        id, name, workos_organization_id, approval_threshold_base_units, hard_cap_base_units,
        allowed_token, allowed_chain, amount_review_multiplier, wallet_risk_threshold
      )
      VALUES (
        ${organizationID}, ${name}, ${workosOrganization?.id ?? null}, ${DEFAULT_APPROVAL_THRESHOLD},
        ${DEFAULT_HARD_CAP}, 'usdc', ${BASE_SEPOLIA_CHAIN}, 3.0, 80
      )
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
    `
    const workspace = mapOrganization(must(row, "workspace"))

    if (params.ownerEmail?.trim()) {
      await db.exec`
        INSERT INTO users (id, organization_id, email, role)
        VALUES (${id("usr")}, ${workspace.id}, ${params.ownerEmail.trim()}, 'owner')
        ON CONFLICT (organization_id, lower(email))
        DO UPDATE SET role = 'owner'
      `
    }

    await appendAudit(
      workspace.id,
      "organization",
      workspace.id,
      "workspace.bootstrapped",
      { workspace },
      systemActor(workspace.id),
    )
    return { workspace }
  },
)

export const getWorkspace = api(
  { expose: true, auth: true, method: "GET", path: "/workspace" },
  async (): Promise<{ workspace: OrganizationRecord }> => {
    const actor = await requireActor()
    const workspace = await loadOrganization(actor.organizationID)
    if (!workspace) throw APIError.notFound("workspace not found")
    return { workspace }
  },
)

export const updateWorkspace = api(
  { expose: true, auth: true, method: "POST", path: "/workspace/settings" },
  async (params: UpdateWorkspaceRequest): Promise<{ workspace: OrganizationRecord }> => {
    const actor = await requireActor(["owner", "finance"])
    const current = await loadOrganization(actor.organizationID)
    if (!current) throw APIError.notFound("workspace not found")

    const row = await db.queryRow<OrganizationRow>`
      UPDATE organizations
      SET
        approval_threshold_base_units = ${params.approvalThresholdBaseUnits ?? current.approvalThresholdBaseUnits},
        hard_cap_base_units = ${params.hardCapBaseUnits ?? current.hardCapBaseUnits},
        allowed_token = ${normalize(params.allowedToken ?? current.allowedToken)},
        allowed_chain = ${normalize(params.allowedChain ?? current.allowedChain)},
        amount_review_multiplier = ${params.amountReviewMultiplier ?? current.amountReviewMultiplier},
        wallet_risk_threshold = ${params.walletRiskThreshold ?? current.walletRiskThreshold}
      WHERE id = ${actor.organizationID}
      RETURNING *
    `
    const workspace = mapOrganization(must(row, "workspace"))
    await appendAudit(
      actor.organizationID,
      "organization",
      actor.organizationID,
      "workspace.updated",
      {
        workspace,
      },
      userActor(actor),
    )
    return { workspace }
  },
)

export const listUsers = api(
  { expose: true, auth: true, method: "GET", path: "/users" },
  async (): Promise<{ users: UserRecord[] }> => {
    const actor = await requireActor(["owner", "finance", "approver", "viewer"])
    const rows = await db.queryAll<UserRow>`
      SELECT * FROM users
      WHERE organization_id = ${actor.organizationID}
      ORDER BY created_at DESC
    `
    return { users: rows.map(mapUser) }
  },
)

export const createVendor = api(
  { expose: true, auth: true, method: "POST", path: "/vendors" },
  async (params: CreateVendorRequest): Promise<{ vendor: Vendor }> => {
    const actor = await requireActor(["owner", "finance"])
    const name = params.name.trim()
    if (!name) throw APIError.invalidArgument("vendor name is required")
    const vendor = await upsertVendor(actor.organizationID, {
      name,
      status: params.status ?? "pending",
      riskScore: params.riskScore ?? 0,
    })
    await appendAudit(
      actor.organizationID,
      "vendor",
      vendor.id,
      "vendor.upserted",
      { vendor },
      userActor(actor),
    )
    return { vendor }
  },
)

export const listVendors = api(
  { expose: true, auth: true, method: "GET", path: "/vendors" },
  async (): Promise<{ vendors: Vendor[] }> => {
    const actor = await requireActor()
    const rows = await db.queryAll<VendorRow>`
      SELECT * FROM vendors
      WHERE organization_id = ${actor.organizationID}
      ORDER BY created_at DESC
    `
    return { vendors: rows.map(mapVendor) }
  },
)

export const getVendor = api(
  { expose: true, auth: true, method: "GET", path: "/vendors/:id" },
  async ({ id }: { id: string }): Promise<VendorDetailResponse> => {
    const actor = await requireActor()
    const vendor = await findVendor(actor.organizationID, id)
    if (!vendor) throw APIError.notFound("vendor not found")
    const wallets = await listVendorWallets(actor.organizationID, vendor.id)
    return {
      vendor,
      wallets,
      onboardingChecklist: buildVendorChecklist(vendor, wallets),
      auditEvents: await auditTrail(actor.organizationID, "vendor", vendor.id),
    }
  },
)

export const addVendorWallet = api(
  { expose: true, auth: true, method: "POST", path: "/vendors/:vendorID/wallets" },
  async (params: AddWalletRequest): Promise<{ wallet: VendorWallet }> => {
    const actor = await requireActor(["owner", "finance"])
    ensureAddress(params.address)
    const vendor = await findVendor(actor.organizationID, params.vendorID)
    if (!vendor) throw APIError.notFound("vendor not found")

    const row = await db.queryRow<VendorWalletRow>`
      INSERT INTO vendor_wallets (
        id, organization_id, vendor_id, chain, address, status, approved_at, approved_by
      )
      VALUES (
        ${id("wal")}, ${actor.organizationID}, ${params.vendorID}, ${normalize(params.chain)},
        ${params.address}, ${params.status ?? "pending"},
        ${params.status === "approved" ? new Date() : null},
        ${params.status === "approved" ? actor.userID : null}
      )
      ON CONFLICT (organization_id, vendor_id, chain, lower(address))
      DO UPDATE SET
        status = EXCLUDED.status,
        approved_at = EXCLUDED.approved_at,
        approved_by = EXCLUDED.approved_by
      RETURNING *
    `

    const wallet = mapWallet(must(row, "wallet"))
    await appendAudit(
      actor.organizationID,
      "vendor",
      params.vendorID,
      "vendor_wallet.upserted",
      { wallet },
      userActor(actor),
    )
    return { wallet }
  },
)

export const uploadInvoice = api(
  { expose: true, auth: true, method: "POST", path: "/invoices/upload", sensitive: true },
  async (params: UploadInvoiceRequest): Promise<{ upload: InvoiceUploadRecord }> => {
    const actor = await requireActor(["owner", "finance"])
    const contentType = normalize(params.contentType)
    if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
      throw APIError.invalidArgument("unsupported invoice content type")
    }

    const bytes = decodeBase64(params.contentBase64)
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
      throw APIError.invalidArgument("invoice must be between 1 byte and 10 MB")
    }

    rejectIfUnsafeDocument(bytes, params.fileName)
    const uploadID = id("upl")
    const objectKey = `invoices/${actor.organizationID}/${uploadID}/${sanitizeFileName(params.fileName)}`
    const sha256 = sha256Buffer(bytes)
    await invoiceDocumentsBucket.upload(objectKey, bytes, { contentType })

    const metadata = {
      vendorID: params.vendorID,
      vendorNameHint: params.vendorNameHint,
      invoiceNumberHint: params.invoiceNumberHint,
      amountBaseUnitsHint: params.amountBaseUnitsHint,
      tokenHint: params.tokenHint,
      chainHint: params.chainHint,
      walletAddressHint: params.walletAddressHint,
      paymentMemoHint: params.paymentMemoHint,
    }

    const row = await db.queryRow<InvoiceUploadRow>`
      INSERT INTO invoice_uploads (
        id, organization_id, object_key, file_name, content_type, size_bytes, sha256_hash,
        scan_status, extraction_status, metadata_json, created_by
      )
      VALUES (
        ${uploadID}, ${actor.organizationID}, ${objectKey}, ${params.fileName.trim()}, ${contentType},
        ${bytes.byteLength}, ${sha256}, 'clean', 'queued', ${JSON.stringify(metadata)}, ${actor.userID}
      )
      RETURNING *
    `

    const upload = mapUpload(must(row, "upload"))
    await appendAudit(
      actor.organizationID,
      "invoice_upload",
      upload.id,
      "invoice.uploaded",
      { upload },
      userActor(actor),
    )
    await extractionRequestedTopic.publish({
      uploadID: upload.id,
      organizationID: actor.organizationID,
      actorUserID: actor.userID,
    })
    return { upload }
  },
)

export const createInvoice = api(
  { expose: true, auth: true, method: "POST", path: "/invoices" },
  async (params: CreateInvoiceRequest): Promise<{ invoice: Invoice; policyRun: PolicyRun }> => {
    const actor = await requireActor(["owner", "finance"])
    const vendor = await findVendor(actor.organizationID, params.vendorID)
    if (!vendor) throw APIError.notFound("vendor not found")

    const invoice = await persistInvoice(actor.organizationID, {
      vendor,
      invoiceNumber: params.invoiceNumber,
      invoiceHash: params.documentHash?.trim() || fingerprintManualInvoice(params),
      vendorNameRaw: params.vendorNameRaw ?? vendor.name,
      amountBaseUnits: params.amountBaseUnits,
      amountDecimal: params.amountDecimal ?? baseUnitsToDecimal(params.amountBaseUnits),
      token: params.token,
      chain: params.chain,
      walletAddress: params.walletAddress,
      extractionConfidence: params.extractionConfidence,
      walletConfidence: params.walletConfidence ?? 0.99,
      invoiceDate: params.invoiceDate,
      dueDate: params.dueDate,
      paymentMemo: params.paymentMemo,
      lineItemSummary: params.lineItemSummary,
      extractionModel: "manual",
      extraction: { source: "manual" },
    })
    await appendAudit(
      actor.organizationID,
      "invoice",
      invoice.id,
      "invoice.created",
      { invoice },
      userActor(actor),
    )
    const policyRun = await runPolicy(invoice, userActor(actor), true)
    const updatedInvoice = await updateInvoiceStatus(
      actor.organizationID,
      invoice.id,
      statusForPolicy(policyRun.result),
    )
    return { invoice: updatedInvoice, policyRun }
  },
)

export const listInvoices = api(
  { expose: true, auth: true, method: "GET", path: "/invoices" },
  async (params: ListInvoicesRequest): Promise<{ invoices: Invoice[] }> => {
    const actor = await requireActor()
    const rows = params.status
      ? await db.queryAll<InvoiceRow>`
          SELECT * FROM invoices
          WHERE organization_id = ${actor.organizationID} AND status = ${params.status}
          ORDER BY created_at DESC
        `
      : await db.queryAll<InvoiceRow>`
          SELECT * FROM invoices
          WHERE organization_id = ${actor.organizationID}
          ORDER BY created_at DESC
        `
    return { invoices: rows.map(mapInvoice) }
  },
)

export const getInvoice = api(
  { expose: true, auth: true, method: "GET", path: "/invoices/:id" },
  async ({ id }: { id: string }): Promise<InvoiceDetailResponse> => {
    const actor = await requireActor()
    const invoice = await findInvoice(actor.organizationID, id)
    if (!invoice) throw APIError.notFound("invoice not found")

    const approvals = await listApprovals(actor.organizationID, invoice.id)
    const uploads = await listUploadsForInvoice(actor.organizationID, invoice.id)
    const paymentIntents = await listPaymentIntents(actor.organizationID, invoice.id)

    return {
      invoice,
      policyRun: await latestPolicyRun(actor.organizationID, invoice.id),
      approvals,
      uploads,
      paymentIntents,
      auditEvents: await auditTrail(actor.organizationID, "invoice", invoice.id),
    }
  },
)

export const evaluatePolicy = api(
  { expose: true, auth: true, method: "POST", path: "/policy/evaluate" },
  async ({ invoiceID }: { invoiceID: string }): Promise<{ policyRun: PolicyRun }> => {
    const actor = await requireActor(["owner", "finance", "approver"])
    const invoice = await findInvoice(actor.organizationID, invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    const policyRun = await runPolicy(invoice, userActor(actor), true)
    await updateInvoiceStatus(actor.organizationID, invoice.id, statusForPolicy(policyRun.result))
    return { policyRun }
  },
)

export const simulatePolicy = api(
  { expose: true, auth: true, method: "POST", path: "/policy/simulate" },
  async (params: PolicySimulationRequest): Promise<{ policyRun: PolicyRun }> => {
    const actor = await requireActor(["owner", "finance", "approver"])
    const invoice = await findInvoice(actor.organizationID, params.invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    const policyRun = await runPolicy(invoice, userActor(actor), false, params)
    return { policyRun }
  },
)

export const decideApproval = api(
  { expose: true, auth: true, method: "POST", path: "/approvals/:invoiceID" },
  async (params: ApprovalRequest): Promise<{ invoice: Invoice }> => {
    const actor = await requireActor(["owner", "finance", "approver"])
    const invoice = await findInvoice(actor.organizationID, params.invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")

    await db.exec`
      INSERT INTO approvals (id, organization_id, invoice_id, required_role, approver_user_id, decision, reason)
      VALUES (${id("apr")}, ${actor.organizationID}, ${invoice.id}, 'approver', ${actor.userID}, ${params.decision}, ${params.reason ?? null})
    `

    const nextStatus: InvoiceStatus = params.decision === "approved" ? "approved" : "rejected"
    const updated = await updateInvoiceStatus(actor.organizationID, invoice.id, nextStatus)
    await appendAudit(
      actor.organizationID,
      "invoice",
      invoice.id,
      `approval.${params.decision}`,
      {
        approverUserID: actor.userID,
        reason: params.reason,
      },
      userActor(actor),
    )
    return { invoice: updated }
  },
)

export const createPaymentIntent = api(
  { expose: true, auth: true, method: "POST", path: "/payment-intents", sensitive: true },
  async (params: CreatePaymentIntentRequest): Promise<{ paymentIntent: PaymentIntent }> => {
    const actor = await requireActor(["owner", "finance"])
    const existing = await db.queryRow<PaymentIntentRow>`
      SELECT * FROM payment_intents
      WHERE organization_id = ${actor.organizationID} AND idempotency_key = ${params.idempotencyKey}
    `
    if (existing) return { paymentIntent: mapPaymentIntent(existing) }

    const invoice = await findInvoice(actor.organizationID, params.invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    await ensurePayable(invoice, userActor(actor))

    const payload = buildDemoPaymentPayload({
      invoiceID: invoice.id,
      recipientAddress: invoice.walletAddress,
      amountBaseUnits: invoice.amountBaseUnits,
      chain: invoice.chain,
    })
    const row = await db.queryRow<PaymentIntentRow>`
      INSERT INTO payment_intents (
        id, organization_id, invoice_id, chain, token_address, recipient_address,
        amount_base_units, payload_json, status, idempotency_key
      )
      VALUES (
        ${id("pay")}, ${actor.organizationID}, ${invoice.id}, ${invoice.chain}, ${payload.tokenAddress},
        ${invoice.walletAddress}, ${invoice.amountBaseUnits}, ${JSON.stringify(payload)}, 'prepared',
        ${params.idempotencyKey}
      )
      RETURNING *
    `

    await updateInvoiceStatus(actor.organizationID, invoice.id, "payment_intent_created")
    const paymentIntent = mapPaymentIntent(must(row, "payment intent"))
    await appendAudit(
      actor.organizationID,
      "payment_intent",
      paymentIntent.id,
      "payment_intent.created",
      {
        paymentIntent,
      },
      userActor(actor),
    )
    await appendAudit(
      actor.organizationID,
      "invoice",
      invoice.id,
      "payment_intent.created",
      {
        paymentIntentID: paymentIntent.id,
      },
      userActor(actor),
    )
    return { paymentIntent }
  },
)

export const executePaymentIntent = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/payment-intents/:id/execute",
    sensitive: true,
  },
  async (params: ExecutePaymentIntentRequest): Promise<{ paymentIntent: PaymentIntent }> => {
    const actor = await requireActor(["owner", "finance"])
    const existing = await db.queryRow<PaymentIntentRow>`
      SELECT * FROM payment_intents
      WHERE organization_id = ${actor.organizationID} AND id = ${params.id}
    `
    if (!existing) throw APIError.notFound("payment intent not found")
    if (existing.status === "executed") return { paymentIntent: mapPaymentIntent(existing) }

    const invoice = await findInvoice(actor.organizationID, existing.invoice_id)
    if (!invoice) throw APIError.notFound("invoice not found")
    await ensurePayable(invoice, userActor(actor))

    try {
      const execution = await executeCdpTransfer({
        organizationID: actor.organizationID,
        recipientAddress: existing.recipient_address,
        amountBaseUnits: existing.amount_base_units,
        chain: existing.chain,
      })
      const row = await db.queryRow<PaymentIntentRow>`
        UPDATE payment_intents
        SET status = 'executed', tx_hash = ${execution.txHash}, executed_at = now(), failure_reason = null
        WHERE organization_id = ${actor.organizationID} AND id = ${params.id}
        RETURNING *
      `
      await updateInvoiceStatus(actor.organizationID, invoice.id, "executed")
      const paymentIntent = mapPaymentIntent(must(row, "payment intent"))
      await appendAudit(
        actor.organizationID,
        "payment_intent",
        paymentIntent.id,
        "payment_intent.executed",
        {
          txHash: execution.txHash,
          mode: execution.mode,
        },
        userActor(actor),
      )
      await appendAudit(
        actor.organizationID,
        "invoice",
        invoice.id,
        "payment_intent.executed",
        {
          paymentIntentID: paymentIntent.id,
          txHash: execution.txHash,
          mode: execution.mode,
        },
        userActor(actor),
      )
      return { paymentIntent }
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment execution failed"
      await db.exec`
        UPDATE payment_intents
        SET status = 'failed', failure_reason = ${message}
        WHERE organization_id = ${actor.organizationID} AND id = ${params.id}
      `
      await appendAudit(
        actor.organizationID,
        "payment_intent",
        params.id,
        "payment_intent.failed",
        {
          reason: message,
        },
        userActor(actor),
      )
      throw APIError.failedPrecondition(message)
    }
  },
)

export const getAuditTrail = api(
  { expose: true, auth: true, method: "GET", path: "/audit/:entityType/:entityID" },
  async ({
    entityType,
    entityID,
  }: { entityType: string; entityID: string }): Promise<{ auditEvents: AuditEvent[] }> => {
    const actor = await requireActor()
    return {
      auditEvents: await auditTrail(actor.organizationID, entityType, entityID),
    }
  },
)

export const createAuditExport = api(
  { expose: true, auth: true, method: "POST", path: "/audit/exports" },
  async (params: AuditExportRequest): Promise<{ auditExport: AuditExportRecord }> => {
    const actor = await requireActor(["owner", "finance", "approver"])
    const row = await db.queryRow<AuditExportRow>`
      INSERT INTO audit_exports (
        id, organization_id, entity_type, entity_id, format, status, requested_by
      )
      VALUES (
        ${id("aex")}, ${actor.organizationID}, ${normalize(params.entityType)}, ${params.entityID ?? null},
        ${params.format}, 'queued', ${actor.userID}
      )
      RETURNING *
    `
    const auditExport = mapAuditExport(must(row, "audit export"))
    await auditExportRequestedTopic.publish({
      exportID: auditExport.id,
      organizationID: actor.organizationID,
      actorUserID: actor.userID,
    })
    await appendAudit(
      actor.organizationID,
      "audit_export",
      auditExport.id,
      "audit_export.queued",
      {
        auditExport,
      },
      userActor(actor),
    )
    return { auditExport }
  },
)

export const listAuditExports = api(
  { expose: true, auth: true, method: "GET", path: "/audit/exports" },
  async (): Promise<{ auditExports: AuditExportRecord[] }> => {
    const actor = await requireActor()
    const rows = await db.queryAll<AuditExportRow>`
      SELECT * FROM audit_exports
      WHERE organization_id = ${actor.organizationID}
      ORDER BY created_at DESC
    `
    return { auditExports: rows.map(mapAuditExport) }
  },
)

export const getAuditExport = api(
  { expose: true, auth: true, method: "GET", path: "/audit/exports/:id" },
  async ({
    id,
  }: { id: string }): Promise<{ auditExport: AuditExportRecord; downloadURL?: string }> => {
    const actor = await requireActor()
    const row = await db.queryRow<AuditExportRow>`
      SELECT * FROM audit_exports
      WHERE organization_id = ${actor.organizationID} AND id = ${id}
    `
    if (!row) throw APIError.notFound("audit export not found")
    const auditExport = mapAuditExport(row)
    const downloadURL =
      auditExport.status === "completed" && auditExport.objectKey
        ? (await auditExportsBucket.signedDownloadUrl(auditExport.objectKey)).url
        : undefined
    return { auditExport, downloadURL }
  },
)

export const workosAuthorize = api(
  { expose: true, method: "POST", path: "/auth/workos/authorize" },
  async (
    params: WorkOSAuthorizeRequest,
  ): Promise<{
    url: string
    state: string
    codeVerifier: string
  }> =>
    getWorkOSAuthorizationURL({
      redirectURI: params.redirectURI,
      organizationID: params.organizationID,
    }),
)

export const workosExchange = api(
  { expose: true, method: "POST", path: "/auth/workos/exchange", sensitive: true },
  async (
    params: WorkOSExchangeRequest,
  ): Promise<{
    accessToken: string
    refreshToken: string
    sealedSession?: string
    organizationID?: string
    userID: string
    email: string
  }> => {
    const session = await exchangeWorkOSCode({
      code: params.code,
      redirectURI: params.redirectURI,
      codeVerifier: params.codeVerifier,
    })
    await ensureLocalIdentity({
      organizationID: session.organizationID,
      userID: session.user.id,
      email: session.user.email,
      role: "viewer",
    })
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      sealedSession: session.sealedSession,
      organizationID: session.organizationID,
      userID: session.user.id,
      email: session.user.email,
    }
  },
)

export const workosWebhook = api.raw(
  { expose: true, method: "POST", path: "/webhooks/workos" },
  async (req, resp) => {
    try {
      const chunks: Buffer[] = []
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const payload = Buffer.concat(chunks).toString("utf8")
      const event = await verifyWorkOSWebhook(req.headers["workos-signature"]?.toString(), payload)
      resp.writeHead(200, { "Content-Type": "application/json" })
      resp.end(JSON.stringify({ received: true, type: extractWebhookType(event) }))
    } catch (error) {
      resp.writeHead(400, { "Content-Type": "application/json" })
      resp.end(
        JSON.stringify({ error: error instanceof Error ? error.message : "invalid webhook" }),
      )
    }
  },
)

new Subscription(extractionRequestedTopic, "invoice-extraction-worker", {
  handler: async (message) => {
    await processExtractionRequested(message)
  },
})

new Subscription(auditExportRequestedTopic, "audit-export-worker", {
  handler: async (message) => {
    await processAuditExportRequested(message)
  },
})

new Subscription(notificationRequestedTopic, "approval-notification-worker", {
  handler: async (message) => {
    await processNotificationRequested(message)
  },
})

async function processExtractionRequested(message: ExtractionRequestedMessage): Promise<void> {
  const actor = systemActor(message.organizationID)
  const row = await db.queryRow<InvoiceUploadRow>`
    SELECT * FROM invoice_uploads
    WHERE organization_id = ${message.organizationID} AND id = ${message.uploadID}
  `
  if (!row) return
  const upload = mapUpload(row)
  if (upload.invoiceID) return

  await db.exec`
    UPDATE invoice_uploads
    SET extraction_status = 'processing', updated_at = now()
    WHERE organization_id = ${message.organizationID} AND id = ${message.uploadID}
  `

  try {
    const bytes = await invoiceDocumentsBucket.download(upload.objectKey)
    const metadata = parseJSON<Record<string, string | undefined>>(row.metadata_json)
    const extracted = await extractInvoiceDocument({
      bytes,
      contentType: upload.contentType,
      fileName: upload.fileName,
    })

    const vendor = metadata.vendorID
      ? await mustFindVendor(message.organizationID, metadata.vendorID)
      : await upsertVendor(message.organizationID, {
          name:
            metadata.vendorNameHint ??
            extracted.vendorName ??
            upload.fileName.replace(/\.[^.]+$/, ""),
          status: "pending",
          riskScore: 0,
        })

    const amountBaseUnits =
      metadata.amountBaseUnitsHint ?? decimalToBaseUnits(extracted.amountDecimal ?? "0", 6)

    const invoice = await persistInvoice(message.organizationID, {
      vendor,
      invoiceNumber: metadata.invoiceNumberHint ?? extracted.invoiceNumber,
      invoiceHash: upload.sha256Hash,
      vendorNameRaw: extracted.vendorName ?? metadata.vendorNameHint ?? vendor.name,
      amountBaseUnits,
      amountDecimal: extracted.amountDecimal ?? baseUnitsToDecimal(amountBaseUnits),
      token: metadata.tokenHint ?? extracted.token ?? "usdc",
      chain: metadata.chainHint ?? extracted.chain ?? BASE_SEPOLIA_CHAIN,
      walletAddress: metadata.walletAddressHint ?? extracted.walletAddress ?? "",
      extractionConfidence: extracted.extractionConfidence,
      walletConfidence: extracted.walletConfidence,
      invoiceDate: extracted.invoiceDate,
      dueDate: extracted.dueDate,
      paymentMemo: metadata.paymentMemoHint ?? extracted.paymentMemo,
      lineItemSummary: extracted.lineItemSummary,
      extractionModel: process.env.GEMINI_MODEL?.trim() || "heuristic",
      extraction: extracted.raw,
    })

    await db.exec`
      UPDATE invoice_uploads
      SET invoice_id = ${invoice.id}, extraction_status = 'completed', updated_at = now()
      WHERE organization_id = ${message.organizationID} AND id = ${message.uploadID}
    `

    await appendAudit(
      message.organizationID,
      "invoice_upload",
      upload.id,
      "invoice.extracted",
      {
        invoiceID: invoice.id,
      },
      actor,
    )
    await appendAudit(
      message.organizationID,
      "invoice",
      invoice.id,
      "invoice.extracted",
      {
        uploadID: upload.id,
        extraction: extracted.raw,
      },
      actor,
    )
    const policyRun = await runPolicy(invoice, actor, true)
    await updateInvoiceStatus(message.organizationID, invoice.id, statusForPolicy(policyRun.result))
    await maybePublishPolicyNotifications(message.organizationID, invoice, policyRun)
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "invoice extraction failed"
    await db.exec`
      UPDATE invoice_uploads
      SET extraction_status = 'failed', updated_at = now()
      WHERE organization_id = ${message.organizationID} AND id = ${message.uploadID}
    `
    await appendAudit(
      message.organizationID,
      "invoice_upload",
      message.uploadID,
      "invoice.extraction_failed",
      {
        reason: messageText,
      },
      actor,
    )
  }
}

async function processAuditExportRequested(message: AuditExportRequestedMessage): Promise<void> {
  const row = await db.queryRow<AuditExportRow>`
    SELECT * FROM audit_exports
    WHERE organization_id = ${message.organizationID} AND id = ${message.exportID}
  `
  if (!row) return
  const auditExport = mapAuditExport(row)
  if (auditExport.status === "completed") return

  await db.exec`
    UPDATE audit_exports
    SET status = 'processing'
    WHERE organization_id = ${message.organizationID} AND id = ${message.exportID}
  `

  try {
    const events = auditExport.entityID
      ? await auditTrail(message.organizationID, auditExport.entityType, auditExport.entityID)
      : await auditTrailByType(message.organizationID, auditExport.entityType)
    const objectKey = `audit/${message.organizationID}/${auditExport.id}.${auditExport.format}`
    const bytes =
      auditExport.format === "csv"
        ? buildAuditCsv(events)
        : await buildAuditPdf(events, auditExport)
    await auditExportsBucket.upload(objectKey, bytes, {
      contentType: auditExport.format === "csv" ? "text/csv" : "application/pdf",
    })
    await db.exec`
      UPDATE audit_exports
      SET status = 'completed', object_key = ${objectKey}, completed_at = now(), error_message = null
      WHERE organization_id = ${message.organizationID} AND id = ${message.exportID}
    `
    await appendAudit(
      message.organizationID,
      "audit_export",
      auditExport.id,
      "audit_export.completed",
      {
        objectKey,
        format: auditExport.format,
      },
      systemActor(message.organizationID),
    )
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "audit export failed"
    await db.exec`
      UPDATE audit_exports
      SET status = 'failed', error_message = ${messageText}
      WHERE organization_id = ${message.organizationID} AND id = ${message.exportID}
    `
  }
}

async function processNotificationRequested(message: NotificationRequestedMessage): Promise<void> {
  const workspace = await loadOrganization(message.organizationID)
  await sendApprovalNotification({
    organizationName: workspace?.name ?? message.organizationID,
    subject: message.subject,
    body: message.body,
  })
}

async function maybePublishPolicyNotifications(
  organizationID: string,
  invoice: Invoice,
  policyRun: PolicyRun,
): Promise<void> {
  if (policyRun.result === "allow") return
  const workspace = await loadOrganization(organizationID)
  const reason = policyRun.triggeredRules.join(", ")
  const body = [
    `Invoice ${invoice.invoiceNumber ?? invoice.id} for ${invoice.amountDecimal} ${invoice.token.toUpperCase()}`,
    `Policy result: ${policyRun.result.toUpperCase()}`,
    `Rules: ${reason}`,
  ].join("\n")

  await notificationRequestedTopic.publish({
    organizationID,
    channel: "email",
    subject: `Invoice ${policyRun.result}`,
    body,
  })
  await notificationRequestedTopic.publish({
    organizationID,
    channel: "slack",
    subject: `Invoice ${policyRun.result}`,
    body,
  })
  await appendAudit(
    organizationID,
    "invoice",
    invoice.id,
    "notification.queued",
    {
      result: policyRun.result,
    },
    systemActor(organizationID),
  )
  if (workspace) {
    await appendAudit(
      organizationID,
      "organization",
      workspace.id,
      "notification.queued",
      {
        invoiceID: invoice.id,
        result: policyRun.result,
      },
      systemActor(organizationID),
    )
  }
}

async function requireActor(allowedRoles?: readonly AppRole[]): Promise<AuthenticatedActor> {
  const actor = getAuthData() as AuthenticatedActor | null
  if (!actor) throw APIError.unauthenticated("authentication required")
  if (!hasRequiredRole(actor, allowedRoles)) {
    throw APIError.permissionDenied("insufficient role")
  }
  await ensureLocalIdentity(actor)
  return actor
}

async function ensureLocalIdentity(actor: {
  organizationID?: string
  userID: string
  email?: string
  role: AppRole
}): Promise<void> {
  if (!actor.organizationID) return
  let organization = await loadOrganization(actor.organizationID)
  if (!organization) {
    const remoteOrganization =
      hasWorkOSConfig() && actor.organizationID.startsWith("org_")
        ? await fetchWorkOSOrganization(actor.organizationID).catch(() => null)
        : null
    const row = await db.queryRow<OrganizationRow>`
      INSERT INTO organizations (
        id, name, workos_organization_id, approval_threshold_base_units, hard_cap_base_units,
        allowed_token, allowed_chain, amount_review_multiplier, wallet_risk_threshold
      )
      VALUES (
        ${actor.organizationID}, ${remoteOrganization?.name ?? `Workspace ${actor.organizationID.slice(-6)}`},
        ${remoteOrganization?.id ?? (actor.organizationID.startsWith("org_") ? actor.organizationID : null)},
        ${DEFAULT_APPROVAL_THRESHOLD}, ${DEFAULT_HARD_CAP}, 'usdc', ${BASE_SEPOLIA_CHAIN}, 3.0, 80
      )
      ON CONFLICT (id) DO UPDATE SET name = organizations.name
      RETURNING *
    `
    organization = mapOrganization(must(row, "organization"))
  }

  const remoteUser =
    hasWorkOSConfig() && actor.userID.startsWith("user_")
      ? await fetchWorkOSUser(actor.userID).catch(() => null)
      : null
  const email = actor.email?.trim() || remoteUser?.email || `${actor.userID}@local.railguard`
  await db.exec`
    INSERT INTO users (id, organization_id, email, workos_user_id, role)
    VALUES (
      ${actor.userID}, ${organization.id}, ${email},
      ${remoteUser?.id ?? (actor.userID.startsWith("user_") ? actor.userID : null)},
      ${actor.role}
    )
    ON CONFLICT (id)
    DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role
  `
}

async function persistInvoice(
  organizationID: string,
  input: {
    vendor: Vendor
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
    extraction: Record<string, unknown>
  },
): Promise<Invoice> {
  ensurePositiveBaseUnits(input.amountBaseUnits)
  ensureConfidence(input.extractionConfidence)
  if (input.walletAddress) ensureAddress(input.walletAddress)

  const row = await db.queryRow<InvoiceRow>`
    INSERT INTO invoices (
      id, organization_id, vendor_id, invoice_number, invoice_hash, vendor_name_raw,
      amount_base_units, amount_decimal, token, chain, wallet_address, extraction_confidence,
      wallet_confidence, invoice_date, due_date, payment_memo, line_item_summary, extraction_model,
      extraction_json, status
    )
    VALUES (
      ${id("inv")}, ${organizationID}, ${input.vendor.id}, ${input.invoiceNumber ?? null},
      ${input.invoiceHash}, ${input.vendorNameRaw ?? null}, ${input.amountBaseUnits}, ${input.amountDecimal},
      ${normalize(input.token)}, ${normalize(input.chain)}, ${input.walletAddress}, ${input.extractionConfidence},
      ${input.walletConfidence ?? null}, ${parseDate(input.invoiceDate)}, ${parseDate(input.dueDate)},
      ${input.paymentMemo ?? null}, ${input.lineItemSummary ?? null}, ${input.extractionModel ?? null},
      ${JSON.stringify(input.extraction)}, 'received'
    )
    RETURNING *
  `
  return mapInvoice(must(row, "invoice"))
}

async function runPolicy(
  invoice: Invoice,
  actor: SystemActor,
  persist: boolean,
  overrides?: WorkspaceSettings,
): Promise<PolicyRun> {
  const vendor = await findVendor(actor.organizationID, invoice.vendorID)
  if (!vendor) throw APIError.notFound("vendor not found")
  const wallets = await listVendorWallets(actor.organizationID, invoice.vendorID)
  const approvedWallets = wallets.filter((wallet) => wallet.status === "approved")
  const duplicate = await findDuplicateInvoice(actor.organizationID, invoice)
  const workspace = await loadOrganization(actor.organizationID)
  const vendorAverageBaseUnits = await vendorAverage(
    actor.organizationID,
    invoice.vendorID,
    invoice.id,
  )
  const evaluation = evaluateInvoicePolicy({
    vendorStatus: vendor.status,
    vendorRiskScore: vendor.riskScore,
    approvedWallets,
    invoiceNumber: invoice.invoiceNumber,
    invoiceHash: invoice.invoiceHash,
    duplicateInvoiceID: duplicate?.id,
    amountBaseUnits: invoice.amountBaseUnits,
    token: invoice.token,
    chain: invoice.chain,
    walletAddress: invoice.walletAddress,
    extractionConfidence: invoice.extractionConfidence,
    walletConfidence: invoice.walletConfidence,
    walletRiskScore: vendor.riskScore,
    supportedToken: overrides?.allowedToken ?? workspace?.allowedToken ?? "usdc",
    supportedChain: overrides?.allowedChain ?? workspace?.allowedChain ?? BASE_SEPOLIA_CHAIN,
    reviewThresholdBaseUnits: BigInt(
      overrides?.approvalThresholdBaseUnits ??
        workspace?.approvalThresholdBaseUnits ??
        DEFAULT_APPROVAL_THRESHOLD,
    ),
    hardCapBaseUnits: BigInt(
      overrides?.hardCapBaseUnits ?? workspace?.hardCapBaseUnits ?? DEFAULT_HARD_CAP,
    ),
    vendorAverageBaseUnits,
    amountReviewMultiplier:
      overrides?.amountReviewMultiplier ?? workspace?.amountReviewMultiplier ?? 3,
    walletRiskThreshold: overrides?.walletRiskThreshold ?? workspace?.walletRiskThreshold ?? 80,
  })

  if (!persist) {
    return {
      id: id("pol"),
      invoiceID: invoice.id,
      result: evaluation.result,
      triggeredRules: evaluation.triggeredRules,
      evidence: evaluation.evidence,
      createdAt: new Date().toISOString(),
    }
  }

  const row = await db.queryRow<PolicyRunRow>`
    INSERT INTO policy_runs (id, organization_id, invoice_id, result, triggered_rules_json, evidence_json)
    VALUES (
      ${id("pol")}, ${actor.organizationID}, ${invoice.id}, ${evaluation.result},
      ${JSON.stringify(evaluation.triggeredRules)}, ${JSON.stringify(evaluation.evidence)}
    )
    RETURNING *
  `
  const policyRun = mapPolicyRun(must(row, "policy run"))
  await appendAudit(
    actor.organizationID,
    "invoice",
    invoice.id,
    "policy.evaluated",
    { policyRun },
    actor,
  )
  return policyRun
}

async function ensurePayable(invoice: Invoice, actor: SystemActor): Promise<void> {
  const policyRun = await runPolicy(invoice, actor, true)
  if (policyRun.result === "block") {
    throw APIError.failedPrecondition("payment blocked by policy")
  }
  if (policyRun.result === "escalate") {
    const approval = await db.queryRow<{ id: string }>`
      SELECT id FROM approvals
      WHERE organization_id = ${actor.organizationID}
        AND invoice_id = ${invoice.id}
        AND decision = 'approved'
      ORDER BY created_at DESC
      LIMIT 1
    `
    if (!approval) throw APIError.failedPrecondition("payment requires approval")
  }
}

async function upsertVendor(
  organizationID: string,
  input: { name: string; status: VendorStatus; riskScore: number },
): Promise<Vendor> {
  const row = await db.queryRow<VendorRow>`
    INSERT INTO vendors (id, organization_id, name, status, risk_score)
    VALUES (${id("ven")}, ${organizationID}, ${input.name.trim()}, ${input.status}, ${input.riskScore})
    ON CONFLICT (organization_id, lower(name))
    DO UPDATE SET status = EXCLUDED.status, risk_score = EXCLUDED.risk_score
    RETURNING *
  `
  return mapVendor(must(row, "vendor"))
}

async function loadOrganization(organizationID: string): Promise<OrganizationRecord | null> {
  const row = await db.queryRow<OrganizationRow>`
    SELECT * FROM organizations WHERE id = ${organizationID}
  `
  return row ? mapOrganization(row) : null
}

async function findVendor(organizationID: string, vendorID: string): Promise<Vendor | null> {
  const row = await db.queryRow<VendorRow>`
    SELECT * FROM vendors WHERE organization_id = ${organizationID} AND id = ${vendorID}
  `
  return row ? mapVendor(row) : null
}

async function mustFindVendor(organizationID: string, vendorID: string): Promise<Vendor> {
  const vendor = await findVendor(organizationID, vendorID)
  if (!vendor) throw APIError.notFound("vendor not found")
  return vendor
}

async function listVendorWallets(
  organizationID: string,
  vendorID: string,
): Promise<VendorWallet[]> {
  const rows = await db.queryAll<VendorWalletRow>`
    SELECT * FROM vendor_wallets
    WHERE organization_id = ${organizationID} AND vendor_id = ${vendorID}
    ORDER BY first_seen_at DESC
  `
  return rows.map(mapWallet)
}

async function findInvoice(organizationID: string, invoiceID: string): Promise<Invoice | null> {
  const row = await db.queryRow<InvoiceRow>`
    SELECT * FROM invoices WHERE organization_id = ${organizationID} AND id = ${invoiceID}
  `
  return row ? mapInvoice(row) : null
}

async function findDuplicateInvoice(
  organizationID: string,
  invoice: Invoice,
): Promise<Invoice | null> {
  const row = await db.queryRow<InvoiceRow>`
    SELECT * FROM invoices
    WHERE organization_id = ${organizationID}
      AND vendor_id = ${invoice.vendorID}
      AND id <> ${invoice.id}
      AND (
        invoice_hash = ${invoice.invoiceHash}
        OR (${invoice.invoiceNumber ?? null} IS NOT NULL AND invoice_number = ${invoice.invoiceNumber ?? null})
      )
    ORDER BY created_at ASC
    LIMIT 1
  `
  return row ? mapInvoice(row) : null
}

async function vendorAverage(
  organizationID: string,
  vendorID: string,
  currentInvoiceID: string,
): Promise<bigint | undefined> {
  const row = await db.queryRow<{ average_amount: string | null }>`
    SELECT AVG(amount_base_units::numeric)::text AS average_amount
    FROM invoices
    WHERE organization_id = ${organizationID}
      AND vendor_id = ${vendorID}
      AND id <> ${currentInvoiceID}
      AND status IN ('payment_intent_created', 'executed')
  `
  return row?.average_amount
    ? BigInt(row.average_amount.split(".")[0] ?? row.average_amount)
    : undefined
}

async function latestPolicyRun(
  organizationID: string,
  invoiceID: string,
): Promise<PolicyRun | undefined> {
  const row = await db.queryRow<PolicyRunRow>`
    SELECT * FROM policy_runs
    WHERE organization_id = ${organizationID} AND invoice_id = ${invoiceID}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return row ? mapPolicyRun(row) : undefined
}

async function listApprovals(organizationID: string, invoiceID: string): Promise<ApprovalRecord[]> {
  const rows = await db.queryAll<ApprovalRow>`
    SELECT * FROM approvals
    WHERE organization_id = ${organizationID} AND invoice_id = ${invoiceID}
    ORDER BY created_at DESC
  `
  return rows.map(mapApproval)
}

async function listUploadsForInvoice(
  organizationID: string,
  invoiceID: string,
): Promise<InvoiceUploadRecord[]> {
  const rows = await db.queryAll<InvoiceUploadRow>`
    SELECT * FROM invoice_uploads
    WHERE organization_id = ${organizationID} AND invoice_id = ${invoiceID}
    ORDER BY created_at DESC
  `
  return rows.map(mapUpload)
}

async function listPaymentIntents(
  organizationID: string,
  invoiceID: string,
): Promise<PaymentIntent[]> {
  const rows = await db.queryAll<PaymentIntentRow>`
    SELECT * FROM payment_intents
    WHERE organization_id = ${organizationID} AND invoice_id = ${invoiceID}
    ORDER BY created_at DESC
  `
  return rows.map(mapPaymentIntent)
}

async function updateInvoiceStatus(
  organizationID: string,
  invoiceID: string,
  status: InvoiceStatus,
): Promise<Invoice> {
  const row = await db.queryRow<InvoiceRow>`
    UPDATE invoices
    SET status = ${status}
    WHERE organization_id = ${organizationID} AND id = ${invoiceID}
    RETURNING *
  `
  return mapInvoice(must(row, "invoice"))
}

async function appendAudit(
  organizationID: string,
  entityType: string,
  entityID: string,
  eventType: string,
  event: Record<string, unknown>,
  actor: SystemActor,
): Promise<void> {
  const previous = await db.queryRow<{ event_hash: string }>`
    SELECT event_hash FROM audit_events
    WHERE organization_id = ${organizationID}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `
  const auditID = id("aud")
  const previousHash = previous?.event_hash ?? null
  const eventHash = buildAuditHash({
    eventID: auditID,
    entityType,
    entityID,
    eventType,
    event,
    previousHash,
  })

  await db.exec`
    INSERT INTO audit_events (
      id, organization_id, entity_type, entity_id, actor_type, actor_id,
      event_type, event_json, previous_hash, event_hash
    )
    VALUES (
      ${auditID}, ${organizationID}, ${entityType}, ${entityID}, ${actor.actorType},
      ${actor.actorID}, ${eventType}, ${JSON.stringify(event)}, ${previousHash}, ${eventHash}
    )
  `
}

async function auditTrail(
  organizationID: string,
  entityType: string,
  entityID: string,
): Promise<AuditEvent[]> {
  const rows = await db.queryAll<AuditRow>`
    SELECT * FROM audit_events
    WHERE organization_id = ${organizationID}
      AND entity_type = ${entityType}
      AND entity_id = ${entityID}
    ORDER BY created_at ASC
  `
  return rows.map(mapAudit)
}

async function auditTrailByType(organizationID: string, entityType: string): Promise<AuditEvent[]> {
  const rows = await db.queryAll<AuditRow>`
    SELECT * FROM audit_events
    WHERE organization_id = ${organizationID}
      AND entity_type = ${entityType}
    ORDER BY created_at ASC
  `
  return rows.map(mapAudit)
}

function buildVendorChecklist(vendor: Vendor, wallets: VendorWallet[]): string[] {
  const checklist: string[] = []
  if (vendor.status !== "approved") checklist.push("Approve vendor onboarding")
  if (!wallets.some((wallet) => wallet.status === "approved"))
    checklist.push("Approve at least one wallet")
  if (vendor.riskScore >= 80) checklist.push("Review high vendor risk score")
  if (checklist.length === 0) checklist.push("Vendor is ready for payments")
  return checklist
}

function statusForPolicy(result: PolicyResult): InvoiceStatus {
  if (result === "allow") return "ready"
  if (result === "escalate") return "needs_approval"
  return "blocked"
}

function userActor(actor: AuthenticatedActor): SystemActor {
  return {
    organizationID: actor.organizationID,
    actorType: "user",
    actorID: actor.userID,
    email: actor.email,
  }
}

function systemActor(organizationID: string): SystemActor {
  return {
    organizationID,
    actorType: "system",
    actorID: "railguard",
  }
}

function ensurePositiveBaseUnits(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw APIError.invalidArgument("amountBaseUnits must be a positive integer string")
  }
  return BigInt(value)
}

function ensureConfidence(value: number): void {
  if (value < 0 || value > 1) {
    throw APIError.invalidArgument("confidence must be between 0 and 1")
  }
}

function ensureAddress(value: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw APIError.invalidArgument("wallet address must be a 0x-prefixed EVM address")
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function sanitizeFileName(fileName: string): string {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, "-")
}

function decodeBase64(value: string): Buffer {
  try {
    return Buffer.from(value, "base64")
  } catch {
    throw APIError.invalidArgument("contentBase64 must be valid base64")
  }
}

function decimalToBaseUnits(value: string, decimals: number): string {
  const normalized = value.trim()
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw APIError.invalidArgument("amountDecimal must be a decimal string")
  }
  const [whole, fractional = ""] = normalized.split(".")
  const padded = `${whole}${fractional.padEnd(decimals, "0").slice(0, decimals)}`
  const compact = padded.replace(/^0+/, "")
  return compact || "0"
}

function baseUnitsToDecimal(value: string): string {
  const padded = value.padStart(7, "0")
  const whole = padded.slice(0, -6)
  const fractional = padded.slice(-6).replace(/0+$/, "")
  return fractional ? `${whole}.${fractional}` : whole
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return null
  return parsed.toISOString().slice(0, 10)
}

function fingerprintManualInvoice(params: CreateInvoiceRequest): string {
  return stableStringify({
    vendorID: params.vendorID,
    invoiceNumber: params.invoiceNumber ?? "",
    amountBaseUnits: params.amountBaseUnits,
    token: normalize(params.token),
    chain: normalize(params.chain),
    walletAddress: params.walletAddress.toLowerCase(),
  })
}

function extractWebhookType(value: unknown): string {
  if (value && typeof value === "object" && "event" in value && typeof value.event === "string") {
    return value.event
  }
  return "unknown"
}

function parseJSON<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T)
}

function must<T>(value: T | null, name: string): T {
  if (!value) throw APIError.internal(`failed to load ${name}`)
  return value
}

function buildAuditCsv(events: AuditEvent[]): Buffer {
  const lines = ["id,entity_type,entity_id,actor_type,actor_id,event_type,event_hash,created_at"]
  for (const event of events) {
    lines.push(
      [
        event.id,
        event.entityType,
        event.entityID,
        event.actorType,
        event.actorID,
        event.eventType,
        event.eventHash,
        event.createdAt,
      ]
        .map(csvEscape)
        .join(","),
    )
  }
  return Buffer.from(lines.join("\n"), "utf8")
}

async function buildAuditPdf(
  events: AuditEvent[],
  auditExport: AuditExportRecord,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  let page = pdf.addPage([612, 792])
  let y = 760
  const lines = [
    "Railguard Audit Export",
    `Entity: ${auditExport.entityType}${auditExport.entityID ? `/${auditExport.entityID}` : ""}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ...events.flatMap((event) => [
      `${event.createdAt} ${event.eventType}`,
      `${event.entityType}/${event.entityID} hash=${event.eventHash}`,
      "",
    ]),
  ]

  for (const line of lines) {
    if (y < 40) {
      page = pdf.addPage([612, 792])
      y = 760
    }
    page.drawText(line.slice(0, 110), {
      x: 40,
      y,
      size: 10,
      font,
      color: rgb(0.12, 0.12, 0.12),
    })
    y -= 14
  }

  return Buffer.from(await pdf.save())
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

interface OrganizationRow {
  id: string
  name: string
  workos_organization_id: string | null
  approval_threshold_base_units: string
  hard_cap_base_units: string
  allowed_token: string
  allowed_chain: string
  amount_review_multiplier: number
  wallet_risk_threshold: number
  created_at: Date
}

interface UserRow {
  id: string
  organization_id: string
  email: string
  workos_user_id: string | null
  role: AppRole
  created_at: Date
}

interface VendorRow {
  id: string
  organization_id: string
  name: string
  status: VendorStatus
  risk_score: number
  created_at: Date
}

interface VendorWalletRow {
  id: string
  vendor_id: string
  chain: string
  address: string
  status: VendorStatus
  first_seen_at: Date
  approved_at: Date | null
  approved_by: string | null
}

interface InvoiceRow {
  id: string
  organization_id: string
  vendor_id: string
  invoice_number: string | null
  invoice_hash: string
  vendor_name_raw: string | null
  amount_base_units: string
  amount_decimal: string
  token: string
  chain: string
  wallet_address: string
  extraction_confidence: number
  wallet_confidence: number | null
  invoice_date: Date | null
  due_date: Date | null
  payment_memo: string | null
  line_item_summary: string | null
  extraction_model: string | null
  extraction_json: unknown
  status: InvoiceStatus
  created_at: Date
}

interface InvoiceUploadRow {
  id: string
  organization_id: string
  invoice_id: string | null
  object_key: string
  file_name: string
  content_type: string
  size_bytes: number
  sha256_hash: string
  scan_status: ScanStatus
  extraction_status: InvoiceUploadRecord["extractionStatus"]
  metadata_json: unknown
  created_by: string
  created_at: Date
  updated_at: Date
}

interface PolicyRunRow {
  id: string
  invoice_id: string
  result: PolicyResult
  triggered_rules_json: unknown
  evidence_json: unknown
  created_at: Date
}

interface ApprovalRow {
  id: string
  invoice_id: string
  required_role: string
  approver_user_id: string
  decision: "approved" | "rejected"
  reason: string | null
  created_at: Date
}

interface PaymentIntentRow {
  id: string
  invoice_id: string
  chain: string
  token_address: string
  recipient_address: string
  amount_base_units: string
  payload_json: unknown
  status: PaymentIntentStatus
  idempotency_key: string
  tx_hash: string | null
  created_at: Date
}

interface AuditRow {
  id: string
  entity_type: string
  entity_id: string
  actor_type: string
  actor_id: string
  event_type: string
  event_json: unknown
  previous_hash: string | null
  event_hash: string
  created_at: Date
}

interface AuditExportRow {
  id: string
  organization_id: string
  entity_type: string
  entity_id: string | null
  format: "csv" | "pdf"
  object_key: string | null
  status: AuditExportStatus
  requested_by: string
  error_message: string | null
  created_at: Date
  completed_at: Date | null
}

function mapOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    workosOrganizationID: row.workos_organization_id ?? undefined,
    approvalThresholdBaseUnits: row.approval_threshold_base_units,
    hardCapBaseUnits: row.hard_cap_base_units,
    allowedToken: row.allowed_token,
    allowedChain: row.allowed_chain,
    amountReviewMultiplier: row.amount_review_multiplier,
    walletRiskThreshold: row.wallet_risk_threshold,
    createdAt: row.created_at.toISOString(),
  }
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    organizationID: row.organization_id,
    email: row.email,
    workosUserID: row.workos_user_id ?? undefined,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  }
}

function mapVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    organizationID: row.organization_id,
    name: row.name,
    status: row.status,
    riskScore: row.risk_score,
    createdAt: row.created_at.toISOString(),
  }
}

function mapWallet(row: VendorWalletRow): VendorWallet {
  return {
    id: row.id,
    vendorID: row.vendor_id,
    chain: row.chain,
    address: row.address,
    status: row.status,
    firstSeenAt: row.first_seen_at.toISOString(),
    approvedAt: row.approved_at?.toISOString(),
    approvedBy: row.approved_by ?? undefined,
  }
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    organizationID: row.organization_id,
    vendorID: row.vendor_id,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceHash: row.invoice_hash,
    vendorNameRaw: row.vendor_name_raw ?? undefined,
    amountBaseUnits: row.amount_base_units,
    amountDecimal: row.amount_decimal,
    token: row.token,
    chain: row.chain,
    walletAddress: row.wallet_address,
    extractionConfidence: row.extraction_confidence,
    walletConfidence: row.wallet_confidence ?? undefined,
    invoiceDate: row.invoice_date?.toISOString().slice(0, 10),
    dueDate: row.due_date?.toISOString().slice(0, 10),
    paymentMemo: row.payment_memo ?? undefined,
    lineItemSummary: row.line_item_summary ?? undefined,
    extractionModel: row.extraction_model ?? undefined,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  }
}

function mapUpload(row: InvoiceUploadRow): InvoiceUploadRecord {
  return {
    id: row.id,
    organizationID: row.organization_id,
    invoiceID: row.invoice_id ?? undefined,
    objectKey: row.object_key,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sha256Hash: row.sha256_hash,
    scanStatus: row.scan_status,
    extractionStatus: row.extraction_status,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapPolicyRun(row: PolicyRunRow): PolicyRun {
  return {
    id: row.id,
    invoiceID: row.invoice_id,
    result: row.result,
    triggeredRules: parseJSON<string[]>(row.triggered_rules_json),
    evidence: parseJSON<Record<string, unknown>>(row.evidence_json),
    createdAt: row.created_at.toISOString(),
  }
}

function mapApproval(row: ApprovalRow): ApprovalRecord {
  return {
    id: row.id,
    invoiceID: row.invoice_id,
    requiredRole: row.required_role,
    approverUserID: row.approver_user_id,
    decision: row.decision,
    reason: row.reason ?? undefined,
    createdAt: row.created_at.toISOString(),
  }
}

function mapPaymentIntent(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    invoiceID: row.invoice_id,
    chain: row.chain,
    tokenAddress: row.token_address,
    recipientAddress: row.recipient_address,
    amountBaseUnits: row.amount_base_units,
    payload: parseJSON<Record<string, unknown>>(row.payload_json),
    status: row.status,
    idempotencyKey: row.idempotency_key,
    txHash: row.tx_hash ?? undefined,
    createdAt: row.created_at.toISOString(),
  }
}

function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityID: row.entity_id,
    actorType: row.actor_type,
    actorID: row.actor_id,
    eventType: row.event_type,
    event: parseJSON<Record<string, unknown>>(row.event_json),
    previousHash: row.previous_hash ?? undefined,
    eventHash: row.event_hash,
    createdAt: row.created_at.toISOString(),
  }
}

function mapAuditExport(row: AuditExportRow): AuditExportRecord {
  return {
    id: row.id,
    organizationID: row.organization_id,
    entityType: row.entity_type,
    entityID: row.entity_id ?? undefined,
    format: row.format,
    status: row.status,
    objectKey: row.object_key ?? undefined,
    requestedBy: row.requested_by,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
  }
}
