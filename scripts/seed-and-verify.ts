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
  status: "prepared" | "executed" | "failed"
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

type RunMode = "curated" | "stress"

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

const baseURL = stripTrailingSlash(
  env(
    "RAILGUARD_BASE_URL",
    env("NEXT_PUBLIC_API_URL", env("APP_BASE_URL", "http://localhost:4000")),
  ),
)
const mode = (
  (env("RAILGUARD_MODE", "curated").toLowerCase() as RunMode) === "stress" ? "stress" : "curated"
) as RunMode
const runID = env(
  "RAILGUARD_RUN_ID",
  new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14),
)
const requestedOrgID = env(
  "RAILGUARD_ORG_ID",
  mode === "curated" ? `org_curated_${runID}` : "org_demo_rollout",
)
const workspaceName = env(
  "RAILGUARD_WORKSPACE_NAME",
  mode === "curated" ? `Railguard Showcase ${runID}` : "Railguard Demo Verification",
)
const ownerEmail = env("RAILGUARD_OWNER_EMAIL", "ops@railguard.ai")

let activeOrgID = requestedOrgID

const authHeaders = () => ({
  Authorization: "Bearer demo-token",
  "X-Organization-Id": activeOrgID,
  "X-Role": "owner",
  "X-User-Id": env("RAILGUARD_USER_ID", "usr_operator_primary"),
  "X-User-Email": env("RAILGUARD_USER_EMAIL", "ops@railguard.ai"),
})

async function api<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    auth?: boolean
  } = {},
): Promise<T> {
  const res = await fetch(`${baseURL}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.auth === false ? {} : authHeaders()),
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
  return `RG-${label}-${runID}`
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

async function ensureWorkspace(): Promise<Workspace> {
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

async function createVendor(name: string, status: VendorStatus): Promise<Vendor> {
  const response = await api<{ vendor: Vendor }>("/vendors", {
    body: { name, status, riskScore: status === "blocked" ? 95 : 10 },
  })
  return response.vendor
}

async function addWallet(vendorID: string, address: string, status: VendorStatus) {
  return api<{ wallet: { id: string; address: string } }>(`/vendors/${vendorID}/wallets`, {
    body: { vendorID, address, chain: "base-sepolia", status },
  })
}

async function uploadInvoice(body: Record<string, unknown>) {
  return api<{ upload: { id: string } }>("/invoices/upload", { body })
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

async function evaluateInvoice(invoiceID: string) {
  return api<{ policyRun: PolicyRun }>("/policy/evaluate", {
    body: { invoiceID },
  })
}

async function waitForInvoiceByNumber(invoiceNumber: string, expectedStatus?: InvoiceStatus) {
  return poll(
    `invoice ${invoiceNumber}`,
    async () => {
      const response = await listInvoices()
      return response.invoices.find((invoice) => invoice.invoiceNumber === invoiceNumber) ?? null
    },
    (value) => Boolean(value) && (!expectedStatus || value.status === expectedStatus),
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

async function main() {
  console.log(
    JSON.stringify(
      {
        baseURL,
        mode,
        requestedOrgID,
        runID,
      },
      null,
      2,
    ),
  )

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
  const allowPolicyRun = await evaluateInvoice(allowInvoice.id)
  const allowInvoiceDetail = await getInvoice(allowInvoice.id)
  assert(
    allowPolicyRun.policyRun.result === "allow",
    "Expected allow invoice policy result to be allow",
  )
  assert(allowInvoiceDetail.invoice.status === "ready", "Expected allow invoice status to be ready")

  logStep("simulation-flow", "forcing an approval threshold change")
  const simulated = await api<{ policyRun: PolicyRun }>("/policy/simulate", {
    body: {
      invoiceID: allowInvoice.id,
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
  const escalatedPolicyRun = await evaluateInvoice(escalateInvoice.id)
  const escalateInvoiceDetail = await getInvoice(escalateInvoice.id)
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
            invoice.invoiceNumber === allowInvoiceNumber && invoice.id !== allowInvoice.id,
        ) ?? null
      )
    },
    (value) => Boolean(value),
    45000,
  )
  const blockedPolicyRun = await evaluateInvoice(blockedInvoice.id)
  const blockedInvoiceDetail = await getInvoice(blockedInvoice.id)
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
  const approvalResponse = await api<{ invoice: Invoice }>(`/approvals/${escalateInvoice.id}`, {
    body: {
      invoiceID: escalateInvoice.id,
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
      invoiceID: escalateInvoice.id,
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
    },
  )
  assert(
    executedIntent.paymentIntent.status === "executed",
    "Expected payment intent status to be executed",
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
  const extractedPolicyRun = await evaluateInvoice(extractedInvoice.id)
  const extractedInvoiceDetail = await getInvoice(extractedInvoice.id)
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
      entityID: escalateInvoice.id,
      format: "csv",
    },
  })
  const pdfExport = await api<{ auditExport: AuditExportRecord }>("/audit/exports", {
    body: {
      entityType: "invoice",
      entityID: escalateInvoice.id,
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

  const invoiceDetail = await getInvoice(escalateInvoice.id)
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
          allowInvoice: allowInvoice.id,
          escalatedInvoice: escalateInvoice.id,
          blockedInvoice: blockedInvoice.id,
          uploadedInvoice: extractedInvoice.id,
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

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        baseURL,
        activeOrgID,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  )
  process.exitCode = 1
})
