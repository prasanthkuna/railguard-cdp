import { clearAuthSession, getAuthHeaders, isDevAuthEnabled } from "./auth"
import type {
  AddWalletRequest,
  AuditEvent,
  AuditExportRecord,
  AuthExchangeResponse,
  AuthURLResponse,
  CreateVendorRequest,
  DashboardResponse,
  Invoice,
  InvoiceDetailResponse,
  InvoiceUploadRecord,
  OrganizationRecord,
  PaymentIntent,
  PolicyRun,
  UploadInvoiceRequest,
  Vendor,
  VendorDetailResponse,
  VendorWallet,
} from "./types"

/** Browser calls same-origin /api proxy (avoids CORS). Server uses Encore URL directly. */
function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }
  if (typeof window !== "undefined") {
    return "/api"
  }
  return process.env.ENCORE_API_URL || "http://localhost:4000"
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    let message = "An error occurred"
    try {
      const err = await res.json()
      message = err.message || err.error || message
    } catch {}
    if (!isDevAuthEnabled() && (res.status === 401 || res.status === 403)) {
      clearAuthSession()
    }
    throw new Error(message)
  }

  // Handle empty responses
  const text = await res.text()
  if (!text) return {} as T

  return JSON.parse(text)
}

export const api = {
  // Auth
  workosAuthorize: (redirectURI: string, organizationID?: string) =>
    apiFetch<AuthURLResponse>("/auth/workos/authorize", {
      method: "POST",
      body: JSON.stringify({ redirectURI, organizationID }),
    }),
  workosExchange: (code: string, redirectURI: string, codeVerifier?: string) =>
    apiFetch<AuthExchangeResponse>("/auth/workos/exchange", {
      method: "POST",
      body: JSON.stringify({ code, redirectURI, codeVerifier }),
    }),

  // Workspace
  getWorkspace: () => apiFetch<{ workspace: OrganizationRecord }>("/workspace"),
  bootstrapWorkspace: (name: string, ownerEmail?: string) =>
    apiFetch<{ workspace: OrganizationRecord }>("/workspace/bootstrap", {
      method: "POST",
      body: JSON.stringify({ name, ownerEmail }),
    }),
  updateWorkspace: (data: Partial<OrganizationRecord>) =>
    apiFetch<{ workspace: OrganizationRecord }>("/workspace/settings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Dashboard
  getDashboard: () => apiFetch<DashboardResponse>("/dashboard"),

  // Invoices
  listInvoices: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : ""
    return apiFetch<{ invoices: Invoice[] }>(`/invoices${query}`)
  },
  getInvoice: (id: string) => apiFetch<InvoiceDetailResponse>(`/invoices/${id}`),
  uploadInvoice: (data: UploadInvoiceRequest) =>
    apiFetch<{ upload: InvoiceUploadRecord }>("/invoices/upload", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Vendors
  listVendors: () => apiFetch<{ vendors: Vendor[] }>("/vendors"),
  getVendor: (id: string) => apiFetch<VendorDetailResponse>(`/vendors/${id}`),
  createVendor: (data: CreateVendorRequest) =>
    apiFetch<{ vendor: Vendor }>("/vendors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addVendorWallet: (vendorID: string, data: AddWalletRequest) =>
    apiFetch<{ wallet: VendorWallet }>(`/vendors/${vendorID}/wallets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Policy
  evaluatePolicy: (invoiceID: string) =>
    apiFetch<{ policyRun: PolicyRun }>("/policy/evaluate", {
      method: "POST",
      body: JSON.stringify({ invoiceID }),
    }),
  simulatePolicy: (
    invoiceID: string,
    settings: Pick<
      OrganizationRecord,
      | "approvalThresholdBaseUnits"
      | "hardCapBaseUnits"
      | "allowedToken"
      | "allowedChain"
      | "amountReviewMultiplier"
      | "walletRiskThreshold"
    >,
  ) =>
    apiFetch<{ policyRun: PolicyRun }>("/policy/simulate", {
      method: "POST",
      body: JSON.stringify({ invoiceID, ...settings }),
    }),

  // Approvals
  decideApproval: (invoiceID: string, decision: "approved" | "rejected", reason?: string) =>
    apiFetch<{ invoice: Invoice }>(`/approvals/${invoiceID}`, {
      method: "POST",
      body: JSON.stringify({ invoiceID, decision, reason }),
    }),

  // Payment Intents
  createPaymentIntent: (invoiceID: string, idempotencyKey: string) =>
    apiFetch<{ paymentIntent: PaymentIntent }>("/payment-intents", {
      method: "POST",
      body: JSON.stringify({ invoiceID, idempotencyKey }),
    }),
  executePaymentIntent: (id: string, idempotencyKey: string) =>
    apiFetch<{ paymentIntent: PaymentIntent }>(`/payment-intents/${id}/execute`, {
      method: "POST",
      body: JSON.stringify({ id, idempotencyKey }),
    }),

  // Audit
  getAuditTrail: (entityType: string, entityID: string) =>
    apiFetch<{ auditEvents: AuditEvent[] }>(`/audit/${entityType}/${entityID}`),
  createAuditExport: (entityType: string, entityID: string, format: "csv" | "pdf") =>
    apiFetch<{ auditExport: AuditExportRecord }>("/audit/exports", {
      method: "POST",
      body: JSON.stringify({ entityType, entityID, format }),
    }),
  getAuditExport: (id: string) =>
    apiFetch<{ auditExport: AuditExportRecord; downloadURL?: string }>(`/audit/exports/${id}`),
}
