import {
  clearAuthSession,
  getAuthHeaders,
  getAuthSession,
  isDevAuthEnabled,
  setAuthSession,
} from "./auth"
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

let refreshInFlight: Promise<boolean> | null = null

async function refreshAuthSession(): Promise<boolean> {
  if (isDevAuthEnabled()) return false
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const session = getAuthSession()
    if (!session?.refreshToken) return false

    try {
      const res = await fetch(`${resolveApiUrl()}/auth/workos/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshToken: session.refreshToken,
          organizationID: session.organizationID,
        }),
      })
      if (!res.ok) return false
      const next = (await res.json()) as AuthExchangeResponse
      setAuthSession({
        accessToken: next.accessToken,
        userID: next.userID,
        email: next.email,
        ...(next.refreshToken ? { refreshToken: next.refreshToken } : {}),
        ...(next.sealedSession ? { sealedSession: next.sealedSession } : {}),
        ...(next.organizationID ? { organizationID: next.organizationID } : {}),
      })
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

async function apiFetch<T>(path: string, options?: RequestInit, allowRefresh = true): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    // Attempt a single silent refresh before clearing the session.
    if (
      allowRefresh &&
      !isDevAuthEnabled() &&
      res.status === 401 &&
      !path.startsWith("/auth/workos/")
    ) {
      const refreshed = await refreshAuthSession()
      if (refreshed) {
        return apiFetch<T>(path, options, false)
      }
      clearAuthSession()
    } else if (!isDevAuthEnabled() && res.status === 401 && !path.startsWith("/auth/workos/")) {
      clearAuthSession()
    }

    let message = "An error occurred"
    try {
      const err = await res.json()
      message = err.message || err.error || message
    } catch {}
    throw new Error(message)
  }

  const text = await res.text()
  if (!text) {
    if (path.startsWith("/auth/workos/")) {
      throw new Error("Empty authentication response from API. Please try again.")
    }
    return {} as T
  }

  return JSON.parse(text)
}

export const api = {
  // Auth
  workosAuthorize: (
    redirectURI: string,
    organizationID?: string,
    options?: {
      provider?: "authkit" | "GoogleOAuth"
      screenHint?: "sign-in" | "sign-up"
      loginHint?: string
    },
  ) =>
    apiFetch<AuthURLResponse>("/auth/workos/authorize", {
      method: "POST",
      body: JSON.stringify({
        redirectURI,
        organizationID,
        provider: options?.provider ?? "GoogleOAuth",
        screenHint: options?.screenHint,
        loginHint: options?.loginHint,
      }),
    }),
  workosExchange: (code: string, redirectURI: string, codeVerifier?: string) =>
    apiFetch<AuthExchangeResponse>("/auth/workos/exchange", {
      method: "POST",
      body: JSON.stringify({ code, redirectURI, codeVerifier }),
    }),
  workosPassword: (email: string, password: string, organizationID?: string) =>
    apiFetch<AuthExchangeResponse>("/auth/workos/password", {
      method: "POST",
      body: JSON.stringify({ email, password, organizationID }),
    }),
  workosSignup: (email: string, password: string, organizationID?: string) =>
    apiFetch<AuthExchangeResponse>("/auth/workos/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, organizationID }),
    }),
  workosRefresh: (refreshToken: string, organizationID?: string) =>
    apiFetch<AuthExchangeResponse>("/auth/workos/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken, organizationID }),
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
