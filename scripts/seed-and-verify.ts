import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

type VendorStatus = "pending" | "approved" | "blocked"
type PolicyResult = "allow" | "escalate" | "block"
type InvoiceStatus =
  | "received"
  | "ready"
  | "needs_approval"
  | "blocked"
  | "approved"
  | "rejected"
  | "payment_intent_created"
  | "executed"

interface Workspace {
  id: string
  name: string
  approvalThresholdBaseUnits: string
  hardCapBaseUnits: string
  allowedToken: string
  allowedChain: string
  amountReviewMultiplier: number
  walletRiskThreshold: number
}

interface Vendor {
  id: string
  name: string
  status: VendorStatus
  riskScore?: number
}

interface Invoice {
  id: string
  invoiceNumber?: string
  amountBaseUnits: string
  chain: string
  walletAddress: string
  status: InvoiceStatus
}

interface PolicyRun {
  result: PolicyResult
  triggeredRules: string[]
}

interface PaymentIntent {
  id: string
  status: "prepared" | "executed" | "confirmed" | "failed"
  txHash?: string
}

interface AuditEvent {
  eventType: string
}

interface AuditExportRecord {
  id: string
  status: "queued" | "processing" | "completed" | "failed"
  format: "csv" | "pdf"
  errorMessage?: string
}

interface ApiErrorBody {
  message?: string
  error?: string
}

type RunMode = "curated" | "stress" | "showcase"

function parseEnvFile(fileName: string): Record<string, string> {
  const fullPath = join(process.cwd(), fileName)
  if (!existsSync(fullPath)) return {}

  const values: Record<string, string> = {}
  for (const line of readFileSync(fullPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const splitIndex = trimmed.indexOf("=")
    values[trimmed.slice(0, splitIndex).trim()] = trimmed.slice(splitIndex + 1).trim()
  }
  return values
}

const fileEnv = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
}

function env(name: string, fallback?: string): string {
  return process.env[name] ?? fileEnv[name] ?? fallback ?? ""
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

function parseMode(raw: string): RunMode {
  const value = raw.toLowerCase()
  if (value === "stress") return "stress"
  if (value === "showcase") return "showcase"
  return "curated"
}

const baseURL = stripTrailingSlash(
  env(
    "RAILGUARD_BASE_URL",
    env("NEXT_PUBLIC_API_URL", env("APP_BASE_URL", "http://localhost:4000")),
  ),
)
const mode = parseMode(env("RAILGUARD_MODE", "curated"))
const runID = env(
  "RAILGUARD_RUN_ID",
  new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14),
)
const requestedOrgID = env(
  "RAILGUARD_ORG_ID",
  mode === "showcase"
    ? "org_01KZG3PR1SQX5EPF94709V0GD2"
    : mode === "curated"
      ? `org_curated_${runID}`
      : "org_demo_rollout",
)
const workspaceName = env(
  "RAILGUARD_WORKSPACE_NAME",
  mode === "curated" ? `Railguard Showcase ${runID}` : "Railguard Demo Verification",
)
const ownerEmail = env("RAILGUARD_OWNER_EMAIL", "ops@railguard.ai")

let activeOrgID = requestedOrgID
let accessToken = env("RAILGUARD_ACCESS_TOKEN")
let refreshToken = env("RAILGUARD_REFRESH_TOKEN")

const authHeaders = (): Record<string, string> => {
  if (mode === "showcase") {
    if (!accessToken) throw new Error("RAILGUARD_ACCESS_TOKEN is required for showcase mode")
    return { Authorization: `Bearer ${accessToken}` }
  }
  return {
    Authorization: "Bearer demo-token",
    "X-Organization-Id": activeOrgID,
    "X-Role": "owner",
    "X-User-Id": env("RAILGUARD_USER_ID", "usr_operator_primary"),
    "X-User-Email": env("RAILGUARD_USER_EMAIL", "ops@railguard.ai"),
  }
}

const executorAuthHeaders = (): Record<string, string> => {
  if (mode === "showcase") return authHeaders()
  return {
    Authorization: "Bearer demo-token",
    "X-Organization-Id": activeOrgID,
    "X-Role": "finance",
    "X-User-Id": env("RAILGUARD_EXECUTOR_USER_ID", "usr_executor_verify"),
    "X-User-Email": env("RAILGUARD_EXECUTOR_USER_EMAIL", "finance@railguard.ai"),
  }
}

async function api<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    auth?: boolean
    headers?: Record<string, string>
  } = {},
): Promise<T> {
  const res = await fetch(`${baseURL}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.auth === false ? {} : options.headers ?? authHeaders()),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  const parsed = text ? (JSON.parse(text) as T | ApiErrorBody) : ({} as T)

  if (!res.ok) {
    const message =
      typeof parsed === "object" && parsed
        ? (parsed as ApiErrorBody).message || (parsed as ApiErrorBody).error || text
        : text
    throw new Error(`${res.status} ${res.statusText} for ${path}: ${message}`)
  }

  return parsed as T
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function logStep(step: string, detail?: string) {
  console.log(`\n[verify] ${step}${detail ? `: ${detail}` : ""}`)
}

function makeInvoiceNumber(label: string): string {
  return mode === "showcase" ? label : `RG-${label}-${runID}`
}

function buildSyntheticPdf(lines: string[]): string {
  return ["%PDF-1.1", "1 0 obj << /Type /Catalog >> endobj", "BT", ...lines, "ET", "%%EOF"].join(
    "\n",
  )
}

async function poll<T>(
  label: string,
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 30000,
  intervalMs = 1000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const value = await fn()
    if (predicate(value)) return value
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Timed out while waiting for ${label}`)
}

async function refreshAccessTokenIfNeeded(): Promise<void> {
  if (mode !== "showcase") return
  if (!refreshToken && !accessToken) {
    throw new Error("Provide RAILGUARD_ACCESS_TOKEN or RAILGUARD_REFRESH_TOKEN for showcase mode")
  }
  if (!refreshToken) return

  logStep("auth", "refreshing WorkOS session")
  const refreshed = await api<{
    accessToken: string
    refreshToken: string
    organizationID?: string
    email: string
  }>("/auth/workos/refresh", {
    auth: false,
    body: {
      refreshToken,
      organizationID: requestedOrgID,
    },
  })
  accessToken = refreshed.accessToken
  refreshToken = refreshed.refreshToken
  if (refreshed.organizationID) activeOrgID = refreshed.organizationID
  logStep("auth", `session ready for ${refreshed.email}`)
}

async function ensureWorkspace(): Promise<Workspace> {
  if (mode === "showcase") {
    const existing = await api<{ workspace: Workspace }>("/workspace")
    return existing.workspace
  }

  try {
    const existing = await api<{ workspace: Workspace }>("/workspace")
    return existing.workspace
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("404")) throw error
  }

  logStep("workspace", "bootstrapping dedicated verification workspace")
  const bootstrapped = await api<{ workspace: Workspace }>("/workspace/bootstrap", {
    auth: false,
    body: { name: workspaceName, ownerEmail },
  })
  activeOrgID = bootstrapped.workspace.id
  return bootstrapped.workspace
}

async function upsertWorkspaceSettings(): Promise<Workspace> {
  const response = await api<{ workspace: Workspace }>("/workspace/settings", {
    body: {
      approvalThresholdBaseUnits: "5000000000",
      hardCapBaseUnits: "100000000000",
      allowedToken: "usdc",
      allowedChain: "base-sepolia",
      amountReviewMultiplier: 3,
      walletRiskThreshold: 80,
    },
  })
  return response.workspace
}

async function createVendor(
  name: string,
  status: VendorStatus,
  riskScore?: number,
): Promise<Vendor> {
  const response = await api<{ vendor: Vendor }>("/vendors", {
    body: {
      name,
      status,
      riskScore: riskScore ?? (status === "blocked" ? 95 : status === "approved" ? 10 : 25),
    },
  })
  return response.vendor
}

async function addWallet(vendorID: string, address: string, status: VendorStatus) {
  return api<{ wallet: { id: string; address: string } }>(`/vendors/${vendorID}/wallets`, {
    body: { vendorID, address, chain: "base-sepolia", status },
  })
}

async function listVendors() {
  return api<{ vendors: Vendor[] }>("/vendors")
}

async function findVendorByName(name: string): Promise<Vendor | null> {
  const response = await listVendors()
  return response.vendors.find((vendor) => vendor.name === name) ?? null
}

async function ensureVendor(
  name: string,
  status: VendorStatus,
  wallet: string,
  riskScore?: number,
): Promise<Vendor> {
  const existing = await findVendorByName(name)
  const vendor = existing ?? (await createVendor(name, status, riskScore))
  if (!existing || existing.status !== status || (riskScore != null && existing.riskScore !== riskScore)) {
    if (existing) {
      await createVendor(name, status, riskScore)
    }
  }
  await addWallet(vendor.id, wallet, status === "blocked" ? "blocked" : "approved")
  return (await findVendorByName(name)) ?? vendor
}

async function uploadInvoice(body: Record<string, unknown>) {
  return api<{ upload: { id: string } }>("/invoices/upload", { body })
}

async function createInvoice(body: Record<string, unknown>) {
  return api<{ invoice: Invoice; policyRun: PolicyRun }>("/invoices", { body })
}

async function getInvoice(id: string) {
  return api<{
    invoice: Invoice
    policyRun?: PolicyRun
    paymentIntents: PaymentIntent[]
    auditEvents: AuditEvent[]
  }>(`/invoices/${id}`)
}

async function getDashboard() {
  return api<{
    pendingReview: number
    blocked: number
    needsApproval: number
    readyToPay: number
    totalProtectedBaseUnits: string
    riskEventsDetected: number
  }>("/dashboard")
}

async function listInvoices() {
  return api<{ invoices: Invoice[] }>("/invoices")
}

async function findInvoiceByNumber(
  invoiceNumber: string,
  preferStatuses?: InvoiceStatus[],
): Promise<Invoice | null> {
  const response = await listInvoices()
  const matches = response.invoices.filter((invoice) => invoice.invoiceNumber === invoiceNumber)
  if (matches.length === 0) return null
  if (preferStatuses?.length) {
    for (const status of preferStatuses) {
      const hit = matches.find((invoice) => invoice.status === status)
      if (hit) return hit
    }
  }
  return matches.find((invoice) => invoice.status !== "blocked") ?? matches[0] ?? null
}

async function evaluateInvoice(invoiceID: string) {
  return api<{ policyRun: PolicyRun }>("/policy/evaluate", {
    body: { invoiceID },
  })
}

async function waitForInvoiceByNumber(invoiceNumber: string, expectedStatus?: InvoiceStatus) {
  return poll(
    `invoice ${invoiceNumber}`,
    async () => findInvoiceByNumber(invoiceNumber),
    (value) => Boolean(value) && (!expectedStatus || value!.status === expectedStatus),
    45000,
  )
}

async function waitForAuditExport(id: string) {
  return poll(
    `audit export ${id}`,
    () => api<{ auditExport: AuditExportRecord; downloadURL?: string }>(`/audit/exports/${id}`),
    (value) => value.auditExport.status === "completed" && Boolean(value.downloadURL),
  )
}

async function verifyDownload(url: string, format: "csv" | "pdf") {
  const response = await fetch(url)
  assert(response.ok, `Expected ${format} audit export download to succeed`)
  const bytes = await response.arrayBuffer()
  assert(bytes.byteLength > 0, `Expected ${format} audit export to contain data`)
}

async function ensureManualInvoice(input: {
  invoiceNumber: string
  vendor: Vendor
  amountBaseUnits: string
  walletAddress: string
  paymentMemo: string
  documentHash: string
}): Promise<{ invoice: Invoice; policyRun: PolicyRun; created: boolean }> {
  const existing = await findInvoiceByNumber(input.invoiceNumber)
  if (existing) {
    const detail = await getInvoice(existing.id)
    return {
      invoice: detail.invoice,
      policyRun: detail.policyRun ?? { result: "allow", triggeredRules: [] },
      created: false,
    }
  }

  const created = await createInvoice({
    vendorID: input.vendor.id,
    invoiceNumber: input.invoiceNumber,
    documentHash: input.documentHash,
    amountBaseUnits: input.amountBaseUnits,
    token: "usdc",
    chain: "base-sepolia",
    walletAddress: input.walletAddress,
    extractionConfidence: 0.98,
    walletConfidence: 0.99,
    vendorNameRaw: input.vendor.name,
    paymentMemo: input.paymentMemo,
    lineItemSummary: input.paymentMemo,
  })
  return { invoice: created.invoice, policyRun: created.policyRun, created: true }
}

async function runCuratedOrStress(): Promise<void> {
  const workspace = await ensureWorkspace()
  activeOrgID = workspace.id
  logStep("workspace", `${workspace.name} (${workspace.id})`)

  const updatedWorkspace = await upsertWorkspaceSettings()
  logStep(
    "workspace-settings",
    `${updatedWorkspace.allowedChain} / ${updatedWorkspace.allowedToken}`,
  )

  const approvedVendor = await createVendor(`Acme Freight ${runID}`, "approved")
  await addWallet(approvedVendor.id, "0x1111111111111111111111111111111111111111", "approved")

  const pendingVendor = await createVendor(`Orbit Components ${runID}`, "pending")
  await addWallet(pendingVendor.id, "0x3333333333333333333333333333333333333333", "approved")

  logStep("allow-flow", "uploading approved vendor invoice")
  const allowInvoiceNumber = makeInvoiceNumber("ALLOW")
  await uploadInvoice({
    fileName: `${allowInvoiceNumber}.pdf`,
    contentType: "application/pdf",
    contentBase64: Buffer.from(
      buildSyntheticPdf([
        `Invoice # ${allowInvoiceNumber}`,
        `Vendor: ${approvedVendor.name}`,
        "Amount: 2500.00 USDC",
        "Wallet: 0x1111111111111111111111111111111111111111",
      ]),
      "latin1",
    ).toString("base64"),
    vendorID: approvedVendor.id,
    vendorNameHint: approvedVendor.name,
    invoiceNumberHint: allowInvoiceNumber,
    amountBaseUnitsHint: "2500000000",
    tokenHint: "usdc",
    chainHint: "base-sepolia",
    walletAddressHint: "0x1111111111111111111111111111111111111111",
    paymentMemoHint: `Allow verification ${runID}`,
  })
  const allowInvoice = await waitForInvoiceByNumber(allowInvoiceNumber)
  const allowPolicyRun = await evaluateInvoice(allowInvoice!.id)
  const allowInvoiceDetail = await getInvoice(allowInvoice!.id)
  assert(
    allowPolicyRun.policyRun.result === "allow",
    "Expected allow invoice policy result to be allow",
  )
  assert(allowInvoiceDetail.invoice.status === "ready", "Expected allow invoice status to be ready")

  logStep("simulation-flow", "forcing an approval threshold change")
  const simulated = await api<{ policyRun: PolicyRun }>("/policy/simulate", {
    body: {
      invoiceID: allowInvoice!.id,
      approvalThresholdBaseUnits: "1000000000",
      hardCapBaseUnits: "100000000000",
      allowedToken: "usdc",
      allowedChain: "base-sepolia",
      amountReviewMultiplier: 3,
      walletRiskThreshold: 80,
    },
  })
  assert(
    simulated.policyRun.result === "escalate",
    "Expected policy simulation to escalate the allow invoice",
  )
  assert(
    simulated.policyRun.triggeredRules.includes("amount.requires_review"),
    "Expected policy simulation to include amount.requires_review",
  )

  logStep("escalate-flow", "uploading pending vendor invoice")
  const escalateInvoiceNumber = makeInvoiceNumber("ESCALATE")
  await uploadInvoice({
    fileName: `${escalateInvoiceNumber}.pdf`,
    contentType: "application/pdf",
    contentBase64: Buffer.from(
      buildSyntheticPdf([
        `Invoice # ${escalateInvoiceNumber}`,
        `Vendor: ${pendingVendor.name}`,
        "Amount: 6000.00 USDC",
        "Wallet: 0x3333333333333333333333333333333333333333",
      ]),
      "latin1",
    ).toString("base64"),
    vendorID: pendingVendor.id,
    vendorNameHint: pendingVendor.name,
    invoiceNumberHint: escalateInvoiceNumber,
    amountBaseUnitsHint: "6000000000",
    tokenHint: "usdc",
    chainHint: "base-sepolia",
    walletAddressHint: "0x3333333333333333333333333333333333333333",
    paymentMemoHint: `Escalate verification ${runID}`,
  })
  const escalateInvoice = await waitForInvoiceByNumber(escalateInvoiceNumber)
  const escalatedPolicyRun = await evaluateInvoice(escalateInvoice!.id)
  const escalateInvoiceDetail = await getInvoice(escalateInvoice!.id)
  assert(
    escalatedPolicyRun.policyRun.result === "escalate",
    "Expected pending vendor invoice policy result to be escalate",
  )
  assert(
    escalatedPolicyRun.policyRun.triggeredRules.includes("vendor.pending_onboarding"),
    "Expected escalate invoice to include vendor.pending_onboarding",
  )
  assert(
    escalateInvoiceDetail.invoice.status === "needs_approval",
    "Expected escalate invoice status to be needs_approval",
  )

  logStep("block-flow", "uploading duplicate invoice with wallet change")
  await uploadInvoice({
    fileName: `${allowInvoiceNumber}-duplicate.pdf`,
    contentType: "application/pdf",
    contentBase64: Buffer.from(
      buildSyntheticPdf([
        `Invoice # ${allowInvoiceNumber}`,
        `Vendor: ${approvedVendor.name}`,
        "Amount: 2500.00 USDC",
        "Wallet: 0x2222222222222222222222222222222222222222",
      ]),
      "latin1",
    ).toString("base64"),
    vendorID: approvedVendor.id,
    vendorNameHint: approvedVendor.name,
    invoiceNumberHint: allowInvoiceNumber,
    amountBaseUnitsHint: "2500000000",
    tokenHint: "usdc",
    chainHint: "base-sepolia",
    walletAddressHint: "0x2222222222222222222222222222222222222222",
    paymentMemoHint: `Block verification ${runID}`,
  })
  const blockedInvoice = await poll(
    "blocked duplicate invoice",
    async () => {
      const response = await listInvoices()
      return (
        response.invoices.find(
          (invoice) =>
            invoice.invoiceNumber === allowInvoiceNumber && invoice.id !== allowInvoice!.id,
        ) ?? null
      )
    },
    (value) => Boolean(value),
    45000,
  )
  const blockedPolicyRun = await evaluateInvoice(blockedInvoice!.id)
  assert(blockedPolicyRun.policyRun.result === "block", "Expected duplicate invoice to be blocked")
  assert(
    blockedPolicyRun.policyRun.triggeredRules.includes("invoice.duplicate"),
    "Expected blocked invoice to include invoice.duplicate",
  )
  assert(
    blockedPolicyRun.policyRun.triggeredRules.includes("wallet.changed"),
    "Expected blocked invoice to include wallet.changed",
  )

  logStep("approval-flow", "approving the escalated invoice")
  const approvalResponse = await api<{ invoice: Invoice }>(`/approvals/${escalateInvoice!.id}`, {
    body: {
      invoiceID: escalateInvoice!.id,
      decision: "approved",
      reason: "Verification script approval",
    },
  })
  assert(
    approvalResponse.invoice.status === "approved",
    "Expected escalated invoice to be approved",
  )

  logStep("payment-flow", "creating and executing a payment intent")
  const paymentIntent = await api<{ paymentIntent: PaymentIntent }>("/payment-intents", {
    body: {
      invoiceID: escalateInvoice!.id,
      idempotencyKey: `intent-${runID}`,
    },
  })
  assert(
    paymentIntent.paymentIntent.status === "prepared",
    "Expected payment intent status to be prepared",
  )

  const executedIntent = await api<{ paymentIntent: PaymentIntent }>(
    `/payment-intents/${paymentIntent.paymentIntent.id}/execute`,
    {
      body: {
        id: paymentIntent.paymentIntent.id,
        idempotencyKey: `execute-${runID}`,
      },
      headers: executorAuthHeaders(),
    },
  )
  assert(
    executedIntent.paymentIntent.status === "executed" ||
      executedIntent.paymentIntent.status === "confirmed",
    "Expected payment intent status to be executed or confirmed",
  )
  assert(
    executedIntent.paymentIntent.txHash,
    "Expected executed payment intent to have a transaction hash",
  )

  logStep("extraction-flow", "uploading a synthetic invoice document")
  const uploadInvoiceNumber = makeInvoiceNumber("UPLOAD")
  await uploadInvoice({
    fileName: `${uploadInvoiceNumber}.pdf`,
    contentType: "application/pdf",
    contentBase64: Buffer.from(
      buildSyntheticPdf([
        `Invoice # ${uploadInvoiceNumber}`,
        `Vendor: ${approvedVendor.name}`,
        "Amount: 1500.00 USDC",
        "Wallet: 0x1111111111111111111111111111111111111111",
      ]),
      "latin1",
    ).toString("base64"),
    vendorID: approvedVendor.id,
    vendorNameHint: approvedVendor.name,
    invoiceNumberHint: uploadInvoiceNumber,
    amountBaseUnitsHint: "1500000000",
    tokenHint: "usdc",
    chainHint: "base-sepolia",
    walletAddressHint: "0x1111111111111111111111111111111111111111",
    paymentMemoHint: "Synthetic upload verification",
  })

  const extractedInvoice = await waitForInvoiceByNumber(uploadInvoiceNumber)
  const extractedPolicyRun = await evaluateInvoice(extractedInvoice!.id)
  const extractedInvoiceDetail = await getInvoice(extractedInvoice!.id)
  assert(extractedInvoice, "Expected uploaded invoice to be extracted into an invoice record")
  assert(
    extractedPolicyRun.policyRun.result === "allow",
    "Expected synthetic uploaded invoice to evaluate as allow",
  )
  assert(
    extractedInvoiceDetail.invoice.status === "ready",
    "Expected synthetic uploaded invoice to move to ready after evaluation",
  )

  logStep("audit-export-flow", "generating csv and pdf audit exports")
  const csvExport = await api<{ auditExport: AuditExportRecord }>("/audit/exports", {
    body: {
      entityType: "invoice",
      entityID: escalateInvoice!.id,
      format: "csv",
    },
  })
  const pdfExport = await api<{ auditExport: AuditExportRecord }>("/audit/exports", {
    body: {
      entityType: "invoice",
      entityID: escalateInvoice!.id,
      format: "pdf",
    },
  })

  const completedCsv = await waitForAuditExport(csvExport.auditExport.id)
  const completedPdf = await waitForAuditExport(pdfExport.auditExport.id)
  assert(completedCsv.downloadURL, "Expected csv audit export to include a download URL")
  assert(completedPdf.downloadURL, "Expected pdf audit export to include a download URL")
  await verifyDownload(completedCsv.downloadURL, "csv")
  await verifyDownload(completedPdf.downloadURL, "pdf")

  logStep("dashboard-flow", "verifying aggregate counters")
  const dashboard = await getDashboard()
  assert(dashboard.blocked >= 1, "Expected dashboard.blocked to be at least 1")
  assert(dashboard.readyToPay >= 1, "Expected dashboard.readyToPay to be at least 1")
  assert(
    BigInt(dashboard.totalProtectedBaseUnits) >= 6000000000n,
    "Expected dashboard.totalProtectedBaseUnits to include the approved payment amount",
  )

  const invoiceDetail = await getInvoice(escalateInvoice!.id)
  assert(
    invoiceDetail.invoice.status === "executed",
    "Expected approved invoice detail to be executed",
  )
  assert(
    invoiceDetail.auditEvents.some((event) => event.eventType === "payment_intent.executed"),
    "Expected audit trail to include payment_intent.executed",
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseURL,
        activeOrgID,
        workspace: updatedWorkspace.name,
        created: {
          allowInvoice: allowInvoice!.id,
          escalatedInvoice: escalateInvoice!.id,
          blockedInvoice: blockedInvoice!.id,
          uploadedInvoice: extractedInvoice!.id,
          paymentIntent: executedIntent.paymentIntent.id,
          csvExport: csvExport.auditExport.id,
          pdfExport: pdfExport.auditExport.id,
        },
      },
      null,
      2,
    ),
  )
}

async function runShowcase(): Promise<void> {
  await refreshAccessTokenIfNeeded()

  const workspace = await ensureWorkspace()
  activeOrgID = workspace.id
  logStep("workspace", `${workspace.name} (${workspace.id})`)

  const updatedWorkspace = await upsertWorkspaceSettings()
  logStep(
    "workspace-settings",
    `${updatedWorkspace.allowedChain} / threshold ${updatedWorkspace.approvalThresholdBaseUnits}`,
  )

  const northline = await ensureVendor(
    "Northline Logistics",
    "approved",
    "0x1111111111111111111111111111111111111111",
    12,
  )
  const helix = await ensureVendor(
    "Helix Components",
    "pending",
    "0x3333333333333333333333333333333333333333",
    28,
  )
  const cascade = await ensureVendor(
    "Cascade Media",
    "pending",
    "0x4444444444444444444444444444444444444444",
    22,
  )
  const atlas = await ensureVendor(
    "Atlas Fabrication",
    "approved",
    "0x5555555555555555555555555555555555555555",
    15,
  )
  const meridian = await ensureVendor(
    "Meridian Supplies",
    "pending",
    "0x6666666666666666666666666666666666666666",
    30,
  )
  await ensureVendor(
    "Redwood Offshore",
    "blocked",
    "0x7777777777777777777777777777777777777777",
    95,
  )
  await ensureVendor(
    "Quanta Field Services",
    "approved",
    "0x8888888888888888888888888888888888888888",
    88,
  )

  const cheatSheet: Record<string, { invoiceNumber: string; invoiceID: string; status: string; story: string }> =
    {}

  // Ready / allow (simulator target — keep unique; do not reuse for block/pay)
  logStep("allow", "Northline NL-5101")
  const allow = await ensureManualInvoice({
    invoiceNumber: "NL-5101",
    vendor: northline,
    amountBaseUnits: "2500000000",
    walletAddress: "0x1111111111111111111111111111111111111111",
    paymentMemo: "Q3 freight settlement",
    documentHash: "sha256:showcase-nl-5101",
  })
  assert(
    allow.policyRun.result === "allow" ||
      allow.invoice.status === "ready" ||
      allow.invoice.status === "executed" ||
      allow.invoice.status === "payment_intent_created",
    "NL-5101 should allow",
  )
  cheatSheet.allowReady = {
    invoiceNumber: "NL-5101",
    invoiceID: allow.invoice.id,
    status: allow.invoice.status,
    story: "Clean auto-pass / Policy Simulator",
  }

  logStep("simulate", "threshold flip on NL-5101")
  const simulated = await api<{ policyRun: PolicyRun }>("/policy/simulate", {
    body: {
      invoiceID: allow.invoice.id,
      approvalThresholdBaseUnits: "1000000000",
      hardCapBaseUnits: "100000000000",
      allowedToken: "usdc",
      allowedChain: "base-sepolia",
      amountReviewMultiplier: 3,
      walletRiskThreshold: 80,
    },
  })
  assert(simulated.policyRun.result === "escalate", "Simulation should escalate NL-5101")

  // Needs approval (leave open)
  logStep("escalate", "Helix HX-1904 needs approval")
  const escalate = await ensureManualInvoice({
    invoiceNumber: "HX-1904",
    vendor: helix,
    amountBaseUnits: "6000000000",
    walletAddress: "0x3333333333333333333333333333333333333333",
    paymentMemo: "PO-88412 component kit",
    documentHash: "sha256:showcase-hx-1904",
  })
  if (escalate.invoice.status === "needs_approval") {
    cheatSheet.needsApproval = {
      invoiceNumber: "HX-1904",
      invoiceID: escalate.invoice.id,
      status: escalate.invoice.status,
      story: "Dashboard Needs approval",
    }
  } else if (escalate.created || escalate.invoice.status === "received") {
    const evaluated = await evaluateInvoice(escalate.invoice.id)
    assert(evaluated.policyRun.result === "escalate", "HX-1904 should escalate")
    const detail = await getInvoice(escalate.invoice.id)
    cheatSheet.needsApproval = {
      invoiceNumber: "HX-1904",
      invoiceID: detail.invoice.id,
      status: detail.invoice.status,
      story: "Dashboard Needs approval",
    }
  } else {
    cheatSheet.needsApproval = {
      invoiceNumber: "HX-1904",
      invoiceID: escalate.invoice.id,
      status: escalate.invoice.status,
      story: "Dashboard Needs approval (existing)",
    }
  }

  // Duplicate + wallet change → block (separate number so allow/pay stay clean)
  logStep("block", "Northline NL-5102 duplicate with wallet change")
  const blockBase = await ensureManualInvoice({
    invoiceNumber: "NL-5102",
    vendor: northline,
    amountBaseUnits: "2500000000",
    walletAddress: "0x1111111111111111111111111111111111111111",
    paymentMemo: "Lane surcharge adjustment",
    documentHash: "sha256:showcase-nl-5102",
  })
  let blocked = (await listInvoices()).invoices.find(
    (invoice) =>
      invoice.invoiceNumber === "NL-5102" &&
      invoice.id !== blockBase.invoice.id &&
      invoice.status === "blocked",
  )
  if (!blocked) {
    const blockedCreate = await createInvoice({
      vendorID: northline.id,
      invoiceNumber: "NL-5102",
      documentHash: "sha256:showcase-nl-5102-dup-wallet",
      amountBaseUnits: "2500000000",
      token: "usdc",
      chain: "base-sepolia",
      walletAddress: "0x2222222222222222222222222222222222222222",
      extractionConfidence: 0.97,
      paymentMemo: "Corrected remittance wallet",
    })
    assert(blockedCreate.policyRun.result === "block", "Duplicate wallet-change should block")
    blocked = blockedCreate.invoice
  }
  cheatSheet.blocked = {
    invoiceNumber: "NL-5102",
    invoiceID: blocked!.id,
    status: blocked!.status,
    story: "Dashboard Blocked (duplicate + wallet change)",
  }

  // Reject path
  logStep("reject", "Cascade CM-7730")
  const rejectSeed = await ensureManualInvoice({
    invoiceNumber: "CM-7730",
    vendor: cascade,
    amountBaseUnits: "7200000000",
    walletAddress: "0x4444444444444444444444444444444444444444",
    paymentMemo: "Campaign production invoice",
    documentHash: "sha256:showcase-cm-7730",
  })
  let rejectInvoice = rejectSeed.invoice
  if (rejectInvoice.status === "needs_approval") {
    const rejected = await api<{ invoice: Invoice }>(`/approvals/${rejectInvoice.id}`, {
      body: {
        invoiceID: rejectInvoice.id,
        decision: "rejected",
        reason: "Scope mismatch vs PO-2190",
      },
    })
    rejectInvoice = rejected.invoice
  }
  cheatSheet.rejected = {
    invoiceNumber: "CM-7730",
    invoiceID: rejectInvoice.id,
    status: rejectInvoice.status,
    story: "Rejected approval",
  }

  // Approved + prepared intent only (SoD: same user cannot execute after approving)
  logStep("approve-prepare", "Meridian MS-5512 approve + prepared intent")
  const approveSeed = await ensureManualInvoice({
    invoiceNumber: "MS-5512",
    vendor: meridian,
    amountBaseUnits: "8100000000",
    walletAddress: "0x6666666666666666666666666666666666666666",
    paymentMemo: "Warehouse restock — March",
    documentHash: "sha256:showcase-ms-5512",
  })
  let approveInvoice = approveSeed.invoice
  if (approveInvoice.status === "needs_approval") {
    const approved = await api<{ invoice: Invoice }>(`/approvals/${approveInvoice.id}`, {
      body: {
        invoiceID: approveInvoice.id,
        decision: "approved",
        reason: "Matched receiving report RR-441",
      },
    })
    approveInvoice = approved.invoice
  }
  if (
    approveInvoice.status === "approved" ||
    approveInvoice.status === "payment_intent_created"
  ) {
    const existingIntents = (await getInvoice(approveInvoice.id)).paymentIntents
    if (existingIntents.length === 0) {
      await api<{ paymentIntent: PaymentIntent }>("/payment-intents", {
        body: {
          invoiceID: approveInvoice.id,
          idempotencyKey: "intent-ms-5512",
        },
      })
    }
    approveInvoice = (await getInvoice(approveInvoice.id)).invoice
  }
  cheatSheet.approvedPrepared = {
    invoiceNumber: "MS-5512",
    invoiceID: approveInvoice.id,
    status: approveInvoice.status,
    story: "Approved with prepared intent (Execute needs second operator / SoD)",
  }

  // Prepared-only on allow path (Atlas) — no approval, intent only
  logStep("prepared", "Atlas AF-2208 prepared intent")
  const preparedSeed = await ensureManualInvoice({
    invoiceNumber: "AF-2208",
    vendor: atlas,
    amountBaseUnits: "1800000000",
    walletAddress: "0x5555555555555555555555555555555555555555",
    paymentMemo: "CNC fixture lot B",
    documentHash: "sha256:showcase-af-2208",
  })
  let preparedInvoice = preparedSeed.invoice
  if (preparedInvoice.status === "ready") {
    await api<{ paymentIntent: PaymentIntent }>("/payment-intents", {
      body: {
        invoiceID: preparedInvoice.id,
        idempotencyKey: "intent-af-2208",
      },
    })
    preparedInvoice = (await getInvoice(preparedInvoice.id)).invoice
  }
  cheatSheet.preparedOnly = {
    invoiceNumber: "AF-2208",
    invoiceID: preparedInvoice.id,
    status: preparedInvoice.status,
    story: "Ready to Execute CTA",
  }

  // Execute payment on a dedicated allow invoice — no SoD conflict, no duplicate taint
  logStep("execute", "Northline NL-5103 payment")
  const paySeed = await ensureManualInvoice({
    invoiceNumber: "NL-5103",
    vendor: northline,
    amountBaseUnits: "2750000000",
    walletAddress: "0x1111111111111111111111111111111111111111",
    paymentMemo: "Contract haul week 31",
    documentHash: "sha256:showcase-nl-5103",
  })
  let paidInvoice = paySeed.invoice
  if (paidInvoice.status === "ready") {
    const intent = await api<{ paymentIntent: PaymentIntent }>("/payment-intents", {
      body: {
        invoiceID: paidInvoice.id,
        idempotencyKey: "intent-nl-5103",
      },
    })
    const executed = await api<{ paymentIntent: PaymentIntent }>(
      `/payment-intents/${intent.paymentIntent.id}/execute`,
      {
        body: {
          id: intent.paymentIntent.id,
          idempotencyKey: "execute-nl-5103",
        },
      },
    )
    assert(
      executed.paymentIntent.status === "executed" ||
        executed.paymentIntent.status === "confirmed",
      "NL-5103 execution should succeed",
    )
    assert(executed.paymentIntent.txHash, "Expected tx hash on NL-5103")
    paidInvoice = (await getInvoice(paidInvoice.id)).invoice
  } else if (paidInvoice.status === "payment_intent_created") {
    const detail = await getInvoice(paidInvoice.id)
    const intent = detail.paymentIntents.find((item) => item.status === "prepared")
    if (intent) {
      await api<{ paymentIntent: PaymentIntent }>(`/payment-intents/${intent.id}/execute`, {
        body: { id: intent.id, idempotencyKey: "execute-nl-5103" },
      })
      paidInvoice = (await getInvoice(paidInvoice.id)).invoice
    }
  }
  cheatSheet.executed = {
    invoiceNumber: "NL-5103",
    invoiceID: paidInvoice.id,
    status: paidInvoice.status,
    story: "Executed payment + audit trail",
  }
  cheatSheet.allowReady = {
    invoiceNumber: "NL-5101",
    invoiceID: allow.invoice.id,
    status: (await getInvoice(allow.invoice.id)).invoice.status,
    story: "Clean auto-pass / Policy Simulator",
  }

  // Upload extraction story
  logStep("upload", "Northline NL-1509 upload extraction")
  let uploaded = await findInvoiceByNumber("NL-1509")
  if (!uploaded) {
    await uploadInvoice({
      fileName: "NL-1509.pdf",
      contentType: "application/pdf",
      contentBase64: Buffer.from(
        buildSyntheticPdf([
          "Invoice # NL-1509",
          `Vendor: ${northline.name}`,
          "Amount: 1500.00 USDC",
          "Wallet: 0x1111111111111111111111111111111111111111",
        ]),
        "latin1",
      ).toString("base64"),
      vendorID: northline.id,
      vendorNameHint: northline.name,
      invoiceNumberHint: "NL-1509",
      amountBaseUnitsHint: "1500000000",
      tokenHint: "usdc",
      chainHint: "base-sepolia",
      walletAddressHint: "0x1111111111111111111111111111111111111111",
      paymentMemoHint: "Express lane surcharge",
    })
    uploaded = await waitForInvoiceByNumber("NL-1509")
  }
  cheatSheet.uploaded = {
    invoiceNumber: "NL-1509",
    invoiceID: uploaded!.id,
    status: uploaded!.status,
    story: "Upload / extraction",
  }

  // High-risk vendor block invoice
  logStep("high-risk", "Quanta QF-8801 risk block")
  const quanta = (await findVendorByName("Quanta Field Services"))!
  const riskSeed = await ensureManualInvoice({
    invoiceNumber: "QF-8801",
    vendor: quanta,
    amountBaseUnits: "3200000000",
    walletAddress: "0x8888888888888888888888888888888888888888",
    paymentMemo: "Field survey retainer",
    documentHash: "sha256:showcase-qf-8801",
  })
  assert(
    riskSeed.policyRun.result === "block" || riskSeed.invoice.status === "blocked",
    "High-risk vendor invoice should block",
  )
  cheatSheet.highRiskBlocked = {
    invoiceNumber: "QF-8801",
    invoiceID: riskSeed.invoice.id,
    status: riskSeed.invoice.status,
    story: "High-risk vendor block",
  }

  logStep("audit-export", "CSV + PDF for executed invoice")
  const csvExport = await api<{ auditExport: AuditExportRecord }>("/audit/exports", {
    body: { entityType: "invoice", entityID: paidInvoice.id, format: "csv" },
  })
  const pdfExport = await api<{ auditExport: AuditExportRecord }>("/audit/exports", {
    body: { entityType: "invoice", entityID: paidInvoice.id, format: "pdf" },
  })
  const completedCsv = await waitForAuditExport(csvExport.auditExport.id)
  const completedPdf = await waitForAuditExport(pdfExport.auditExport.id)
  await verifyDownload(completedCsv.downloadURL!, "csv")
  await verifyDownload(completedPdf.downloadURL!, "pdf")

  const dashboard = await getDashboard()
  logStep(
    "dashboard",
    `blocked=${dashboard.blocked} needsApproval=${dashboard.needsApproval} ready=${dashboard.readyToPay}`,
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "showcase",
        baseURL,
        activeOrgID,
        workspace: updatedWorkspace.name,
        cheatSheet,
        dashboard,
        exports: {
          csv: csvExport.auditExport.id,
          pdf: pdfExport.auditExport.id,
        },
      },
      null,
      2,
    ),
  )
}

async function main() {
  console.log(
    JSON.stringify(
      {
        baseURL,
        mode,
        requestedOrgID,
        runID,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      },
      null,
      2,
    ),
  )

  if (mode === "showcase") {
    await runShowcase()
  } else {
    await runCuratedOrStress()
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseURL,
        mode,
        activeOrgID,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
})
