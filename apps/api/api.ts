import { randomUUID } from "node:crypto"
import { APIError, type Query, api } from "encore.dev/api"
import { getAuthData } from "~encore/auth"
import { buildAuditHash } from "../../packages/audit/src"
import { type AppRole, type AuthenticatedActor, hasRequiredRole } from "../../packages/auth/src"
import {
  BASE_SEPOLIA_CHAIN,
  buildDemoPaymentPayload,
  buildDemoTransactionHash,
} from "../../packages/cdp/src"
import type {
  InvoiceRecord as Invoice,
  InvoiceStatus,
  PaymentIntentStatus,
  VendorRecord as Vendor,
  VendorStatus,
  VendorWalletRecord as VendorWallet,
} from "../../packages/db/src"
import { type PolicyResult, evaluateInvoicePolicy } from "../../packages/policy/src"
import { db } from "./db"

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

interface CreateInvoiceRequest {
  vendorID: string
  invoiceNumber?: string
  documentHash?: string
  amountBaseUnits: string
  token: string
  chain: string
  walletAddress: string
  extractionConfidence: number
}

interface ListInvoicesRequest {
  status?: Query<string>
}

interface InvoiceDetailResponse {
  invoice: Invoice
  policyRun?: PolicyRun
  auditEvents: AuditEvent[]
}

interface VendorDetailResponse {
  vendor: Vendor
  wallets: VendorWallet[]
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

const REVIEW_THRESHOLD_BASE_UNITS = 5_000_000_000n
const HARD_CAP_BASE_UNITS = 100_000_000_000n

// Health reports whether the Encore service is live.
export const health = api(
  { expose: true, method: "GET", path: "/health" },
  async (): Promise<{ status: "ok"; service: string }> => ({
    status: "ok",
    service: "railguard-api",
  }),
)

// CreateVendor creates or updates a tenant-scoped vendor registry record.
export const createVendor = api(
  { expose: true, auth: true, method: "POST", path: "/vendors" },
  async (params: CreateVendorRequest): Promise<{ vendor: Vendor }> => {
    const actor = requireActor(["owner", "finance"])
    const name = params.name.trim()
    if (!name) throw APIError.invalidArgument("vendor name is required")

    const vendorID = id("ven")
    const status = params.status ?? "pending"
    const riskScore = params.riskScore ?? 0
    if (riskScore < 0 || riskScore > 100) {
      throw APIError.invalidArgument("riskScore must be between 0 and 100")
    }

    const row = await db.queryRow<VendorRow>`
      INSERT INTO vendors (id, organization_id, name, status, risk_score)
      VALUES (${vendorID}, ${actor.organizationID}, ${name}, ${status}, ${riskScore})
      ON CONFLICT (organization_id, lower(name))
      DO UPDATE SET status = EXCLUDED.status, risk_score = EXCLUDED.risk_score
      RETURNING *
    `

    const vendor = mapVendor(must(row, "vendor"))
    await appendAudit("vendor", vendor.id, "vendor.upserted", { vendor })
    return { vendor }
  },
)

// ListVendors returns tenant-scoped vendor records for the workspace.
export const listVendors = api(
  { expose: true, auth: true, method: "GET", path: "/vendors" },
  async (): Promise<{ vendors: Vendor[] }> => {
    const actor = requireActor()
    const rows = await db.queryAll<VendorRow>`
      SELECT * FROM vendors
      WHERE organization_id = ${actor.organizationID}
      ORDER BY created_at DESC
    `

    return { vendors: rows.map(mapVendor) }
  },
)

// GetVendor returns vendor detail, wallet history, and audit evidence.
export const getVendor = api(
  { expose: true, auth: true, method: "GET", path: "/vendors/:id" },
  async ({ id }: { id: string }): Promise<VendorDetailResponse> => {
    const actor = requireActor()
    const vendor = await findVendor(actor.organizationID, id)
    if (!vendor) throw APIError.notFound("vendor not found")

    const rows = await db.queryAll<VendorWalletRow>`
      SELECT * FROM vendor_wallets
      WHERE organization_id = ${actor.organizationID} AND vendor_id = ${id}
      ORDER BY first_seen_at DESC
    `

    return {
      vendor,
      wallets: rows.map(mapWallet),
      auditEvents: await auditTrail("vendor", id),
    }
  },
)

// AddVendorWallet adds a wallet to the tenant-scoped vendor wallet registry.
export const addVendorWallet = api(
  { expose: true, auth: true, method: "POST", path: "/vendors/:vendorID/wallets" },
  async (params: AddWalletRequest): Promise<{ wallet: VendorWallet }> => {
    const actor = requireActor(["owner", "finance"])
    ensureAddress(params.address)
    const vendor = await findVendor(actor.organizationID, params.vendorID)
    if (!vendor) throw APIError.notFound("vendor not found")

    const walletID = id("wal")
    const status = params.status ?? "pending"
    const approvedAt = status === "approved" ? new Date() : null
    const approvedBy = status === "approved" ? actor.userID : null

    const row = await db.queryRow<VendorWalletRow>`
      INSERT INTO vendor_wallets (
        id, organization_id, vendor_id, chain, address, status, approved_at, approved_by
      )
      VALUES (
        ${walletID}, ${actor.organizationID}, ${params.vendorID}, ${normalize(params.chain)},
        ${params.address}, ${status}, ${approvedAt}, ${approvedBy}
      )
      ON CONFLICT (organization_id, vendor_id, chain, lower(address))
      DO UPDATE SET status = EXCLUDED.status, approved_at = EXCLUDED.approved_at, approved_by = EXCLUDED.approved_by
      RETURNING *
    `

    const wallet = mapWallet(must(row, "wallet"))
    await appendAudit("vendor", params.vendorID, "vendor_wallet.upserted", { wallet })
    return { wallet }
  },
)

// ListInvoices returns invoices for the authenticated organization.
export const listInvoices = api(
  { expose: true, auth: true, method: "GET", path: "/invoices" },
  async (params: ListInvoicesRequest): Promise<{ invoices: Invoice[] }> => {
    const actor = requireActor()
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

// CreateInvoice stores extracted invoice fields and immediately runs deterministic policy checks.
export const createInvoice = api(
  { expose: true, auth: true, method: "POST", path: "/invoices" },
  async (params: CreateInvoiceRequest): Promise<{ invoice: Invoice; policyRun: PolicyRun }> => {
    const actor = requireActor(["owner", "finance"])
    const vendor = await findVendor(actor.organizationID, params.vendorID)
    if (!vendor) throw APIError.notFound("vendor not found")
    ensurePositiveBaseUnits(params.amountBaseUnits)
    ensureAddress(params.walletAddress)
    ensureConfidence(params.extractionConfidence)

    const invoiceID = id("inv")
    const invoiceHash = params.documentHash?.trim() || fingerprint(params)

    const inserted = await db.queryRow<InvoiceRow>`
      INSERT INTO invoices (
        id, organization_id, vendor_id, invoice_number, invoice_hash, amount_base_units,
        token, chain, wallet_address, extraction_confidence, status
      )
      VALUES (
        ${invoiceID}, ${actor.organizationID}, ${params.vendorID}, ${params.invoiceNumber ?? null},
        ${invoiceHash}, ${params.amountBaseUnits}, ${normalize(params.token)}, ${normalize(params.chain)},
        ${params.walletAddress}, ${params.extractionConfidence}, 'received'
      )
      RETURNING *
    `

    let invoice = mapInvoice(must(inserted, "invoice"))
    await appendAudit("invoice", invoice.id, "invoice.created", { invoice })
    const policyRun = await runPolicy(invoice)
    invoice = await updateInvoiceStatus(invoice.id, statusForPolicy(policyRun.result))
    return { invoice, policyRun }
  },
)

// GetInvoice returns invoice detail, latest policy run, and audit evidence.
export const getInvoice = api(
  { expose: true, auth: true, method: "GET", path: "/invoices/:id" },
  async ({ id: invoiceID }: { id: string }): Promise<InvoiceDetailResponse> => {
    const actor = requireActor()
    const invoice = await findInvoice(actor.organizationID, invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    const policyRun = await latestPolicyRun(actor.organizationID, invoiceID)
    const auditEvents = await auditTrail("invoice", invoiceID)
    return { invoice, policyRun, auditEvents }
  },
)

// EvaluatePolicy re-runs deterministic policy for an existing invoice.
export const evaluatePolicy = api(
  { expose: true, auth: true, method: "POST", path: "/policy/evaluate" },
  async ({ invoiceID }: { invoiceID: string }): Promise<{ policyRun: PolicyRun }> => {
    const actor = requireActor(["owner", "finance", "approver"])
    const invoice = await findInvoice(actor.organizationID, invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    const policyRun = await runPolicy(invoice)
    await updateInvoiceStatus(invoice.id, statusForPolicy(policyRun.result))
    return { policyRun }
  },
)

// DecideApproval records an approver decision for an escalated invoice.
export const decideApproval = api(
  { expose: true, auth: true, method: "POST", path: "/approvals/:invoiceID" },
  async (params: ApprovalRequest): Promise<{ invoice: Invoice }> => {
    const actor = requireActor(["owner", "finance", "approver"])
    const invoice = await findInvoice(actor.organizationID, params.invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")

    await db.exec`
      INSERT INTO approvals (id, organization_id, invoice_id, required_role, approver_user_id, decision, reason)
      VALUES (${id("apr")}, ${actor.organizationID}, ${invoice.id}, 'approver', ${actor.userID}, ${params.decision}, ${params.reason ?? null})
    `

    const status = params.decision === "approved" ? "approved" : "rejected"
    const updated = await updateInvoiceStatus(invoice.id, status)
    await appendAudit("invoice", invoice.id, `approval.${params.decision}`, {
      reason: params.reason,
      approverUserID: actor.userID,
    })

    return { invoice: updated }
  },
)

// CreatePaymentIntent builds an idempotent, execution-ready Base Sepolia USDC payment payload.
export const createPaymentIntent = api(
  { expose: true, auth: true, method: "POST", path: "/payment-intents", sensitive: true },
  async (params: CreatePaymentIntentRequest): Promise<{ paymentIntent: PaymentIntent }> => {
    const actor = requireActor(["owner", "finance"])
    const existing = await db.queryRow<PaymentIntentRow>`
      SELECT * FROM payment_intents
      WHERE organization_id = ${actor.organizationID} AND idempotency_key = ${params.idempotencyKey}
    `
    if (existing) return { paymentIntent: mapPaymentIntent(existing) }

    const invoice = await findInvoice(actor.organizationID, params.invoiceID)
    if (!invoice) throw APIError.notFound("invoice not found")
    await ensurePayable(invoice)

    const paymentIntentID = id("pay")
    const payload = {
      ...buildDemoPaymentPayload({
        chain: invoice.chain,
        invoiceID: invoice.id,
        recipientAddress: invoice.walletAddress,
        amountBaseUnits: invoice.amountBaseUnits,
      }),
    }

    const row = await db.queryRow<PaymentIntentRow>`
      INSERT INTO payment_intents (
        id, organization_id, invoice_id, chain, token_address, recipient_address,
        amount_base_units, payload_json, status, idempotency_key
      )
      VALUES (
        ${paymentIntentID}, ${actor.organizationID}, ${invoice.id}, ${invoice.chain},
        ${payload.tokenAddress}, ${invoice.walletAddress}, ${invoice.amountBaseUnits},
        ${JSON.stringify(payload)}, 'prepared', ${params.idempotencyKey}
      )
      RETURNING *
    `

    await updateInvoiceStatus(invoice.id, "payment_intent_created")
    const paymentIntent = mapPaymentIntent(must(row, "payment intent"))
    await appendAudit("payment_intent", paymentIntent.id, "payment_intent.created", {
      paymentIntent,
    })
    await appendAudit("invoice", invoice.id, "payment_intent.created", {
      paymentIntentID: paymentIntent.id,
    })
    return { paymentIntent }
  },
)

// ExecutePaymentIntent simulates CDP execution after re-validating policy and approval gates.
export const executePaymentIntent = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/payment-intents/:id/execute",
    sensitive: true,
  },
  async (params: ExecutePaymentIntentRequest): Promise<{ paymentIntent: PaymentIntent }> => {
    const actor = requireActor(["owner", "finance"])
    const existing = await db.queryRow<PaymentIntentRow>`
      SELECT * FROM payment_intents
      WHERE organization_id = ${actor.organizationID} AND id = ${params.id}
    `
    if (!existing) throw APIError.notFound("payment intent not found")
    if (existing.status === "executed") return { paymentIntent: mapPaymentIntent(existing) }

    const invoice = await findInvoice(actor.organizationID, existing.invoice_id)
    if (!invoice) throw APIError.notFound("invoice not found")
    await ensurePayable(invoice)

    const txHash = buildDemoTransactionHash(`${existing.id}:${params.idempotencyKey}`)
    const row = await db.queryRow<PaymentIntentRow>`
      UPDATE payment_intents
      SET status = 'executed', tx_hash = ${txHash}
      WHERE organization_id = ${actor.organizationID} AND id = ${params.id}
      RETURNING *
    `

    await updateInvoiceStatus(invoice.id, "executed")
    const paymentIntent = mapPaymentIntent(must(row, "payment intent"))
    await appendAudit("payment_intent", paymentIntent.id, "payment_intent.executed", { txHash })
    await appendAudit("invoice", invoice.id, "payment_intent.executed", {
      paymentIntentID: paymentIntent.id,
      txHash,
    })
    return { paymentIntent }
  },
)

// GetAuditTrail returns the hash-chained audit events for an entity.
export const getAuditTrail = api(
  { expose: true, auth: true, method: "GET", path: "/audit/:entityType/:entityID" },
  async ({
    entityType,
    entityID,
  }: { entityType: string; entityID: string }): Promise<{ auditEvents: AuditEvent[] }> => ({
    auditEvents: await auditTrail(entityType, entityID),
  }),
)

async function runPolicy(invoice: Invoice): Promise<PolicyRun> {
  const actor = requireActor()
  const vendor = await findVendor(actor.organizationID, invoice.vendorID)
  if (!vendor) throw APIError.notFound("vendor not found")

  const wallets = await db.queryAll<VendorWalletRow>`
    SELECT * FROM vendor_wallets
    WHERE organization_id = ${actor.organizationID} AND vendor_id = ${invoice.vendorID}
  `
  const approvedWallets = wallets.map(mapWallet).filter((wallet) => wallet.status === "approved")
  const duplicate = await findDuplicateInvoice(actor.organizationID, invoice)
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
    supportedToken: "usdc",
    supportedChain: BASE_SEPOLIA_CHAIN,
    reviewThresholdBaseUnits: REVIEW_THRESHOLD_BASE_UNITS,
    hardCapBaseUnits: HARD_CAP_BASE_UNITS,
  })
  const policyID = id("pol")

  const row = await db.queryRow<PolicyRunRow>`
    INSERT INTO policy_runs (id, organization_id, invoice_id, result, triggered_rules_json, evidence_json)
    VALUES (
      ${policyID}, ${actor.organizationID}, ${invoice.id}, ${evaluation.result},
      ${JSON.stringify(evaluation.triggeredRules)}, ${JSON.stringify(evaluation.evidence)}
    )
    RETURNING *
  `

  const policyRun = mapPolicyRun(must(row, "policy run"))
  await appendAudit("invoice", invoice.id, "policy.evaluated", { policyRun })
  return policyRun
}

async function ensurePayable(invoice: Invoice): Promise<void> {
  const actor = requireActor()
  const policyRun = await runPolicy(invoice)
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
    if (!approval) {
      throw APIError.failedPrecondition("payment requires approval")
    }
  }
}

async function appendAudit(
  entityType: string,
  entityID: string,
  eventType: string,
  event: Record<string, unknown>,
): Promise<void> {
  const actor = requireActor()
  const previous = await db.queryRow<{ event_hash: string }>`
    SELECT event_hash FROM audit_events
    WHERE organization_id = ${actor.organizationID}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `
  const eventID = id("aud")
  const previousHash = previous?.event_hash ?? null
  const eventHash = buildAuditHash({
    eventID,
    entityType,
    entityID,
    eventType,
    event,
    previousHash,
  })

  await db.exec`
    INSERT INTO audit_events (
      id, organization_id, entity_type, entity_id, actor_type, actor_id, event_type,
      event_json, previous_hash, event_hash
    )
    VALUES (
      ${eventID}, ${actor.organizationID}, ${entityType}, ${entityID}, 'user', ${actor.userID},
      ${eventType}, ${JSON.stringify(event)}, ${previousHash}, ${eventHash}
    )
  `
}

function requireActor(allowedRoles?: readonly AppRole[]): AuthenticatedActor {
  const actor = getAuthData() as AuthenticatedActor | null
  if (!actor) throw APIError.unauthenticated("authentication required")
  if (!hasRequiredRole(actor, allowedRoles)) {
    throw APIError.permissionDenied("insufficient role")
  }
  return actor
}

async function findVendor(organizationID: string, vendorID: string): Promise<Vendor | null> {
  const row = await db.queryRow<VendorRow>`
    SELECT * FROM vendors WHERE organization_id = ${organizationID} AND id = ${vendorID}
  `
  return row ? mapVendor(row) : null
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

async function auditTrail(entityType: string, entityID: string): Promise<AuditEvent[]> {
  const actor = requireActor()
  const rows = await db.queryAll<AuditRow>`
    SELECT * FROM audit_events
    WHERE organization_id = ${actor.organizationID}
      AND entity_type = ${entityType}
      AND entity_id = ${entityID}
    ORDER BY created_at ASC
  `
  return rows.map(mapAudit)
}

async function updateInvoiceStatus(invoiceID: string, status: InvoiceStatus): Promise<Invoice> {
  const actor = requireActor()
  const row = await db.queryRow<InvoiceRow>`
    UPDATE invoices SET status = ${status}
    WHERE organization_id = ${actor.organizationID} AND id = ${invoiceID}
    RETURNING *
  `
  return mapInvoice(must(row, "invoice"))
}

function statusForPolicy(result: PolicyResult): InvoiceStatus {
  if (result === "allow") return "ready"
  if (result === "escalate") return "needs_approval"
  return "blocked"
}

function ensurePositiveBaseUnits(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw APIError.invalidArgument("amountBaseUnits must be a positive integer string")
  }
  return BigInt(value)
}

function ensureConfidence(value: number): void {
  if (value < 0 || value > 1) {
    throw APIError.invalidArgument("extractionConfidence must be between 0 and 1")
  }
}

function ensureAddress(value: string): void {
  if (!isAddress(value))
    throw APIError.invalidArgument("wallet address must be a 0x-prefixed EVM address")
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function fingerprint(params: CreateInvoiceRequest): string {
  return sha256(
    stableStringify({
      vendorID: params.vendorID,
      invoiceNumber: params.invoiceNumber ?? "",
      amountBaseUnits: params.amountBaseUnits,
      token: normalize(params.token),
      chain: normalize(params.chain),
      walletAddress: params.walletAddress.toLowerCase(),
    }),
  )
}

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function must<T>(value: T | null, name: string): T {
  if (!value) throw APIError.internal(`failed to load ${name}`)
  return value
}

function parseJSON<T>(value: unknown): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : (value as T)
}

interface VendorRow {
  id: string
  organization_id: string
  name: string
  status: Vendor["status"]
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
  vendor_id: string
  invoice_number: string | null
  invoice_hash: string
  amount_base_units: string
  token: string
  chain: string
  wallet_address: string
  extraction_confidence: number
  status: InvoiceStatus
  created_at: Date
}

interface PolicyRunRow {
  id: string
  invoice_id: string
  result: PolicyResult
  triggered_rules_json: unknown
  evidence_json: unknown
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
    vendorID: row.vendor_id,
    invoiceNumber: row.invoice_number ?? undefined,
    invoiceHash: row.invoice_hash,
    amountBaseUnits: row.amount_base_units,
    token: row.token,
    chain: row.chain,
    walletAddress: row.wallet_address,
    extractionConfidence: row.extraction_confidence,
    status: row.status,
    createdAt: row.created_at.toISOString(),
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
