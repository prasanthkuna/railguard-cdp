import { createHash } from "node:crypto"
import { CdpClient } from "@coinbase/cdp-sdk"
import { WorkOS } from "@workos-inc/node"
import { APIError } from "encore.dev/api"
import { secret } from "encore.dev/config"
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose"
import { http, createPublicClient } from "viem"
import { baseSepolia } from "viem/chains"
import { type AppRole, normalizeAppRole } from "../../packages/auth/src"
import { BASE_SEPOLIA_CHAIN, buildDemoTransactionHash } from "../../packages/cdp/src"
import {
  type ExpectedTransferFacts,
  type SettlementVerificationResult,
  parseErc20TransferLogs,
  verifyDemoSettlement,
  verifyTransferFacts,
} from "../../packages/settlement/src"
import { type PaymentExecutionMode, resolvePaymentMode } from "./config"
import { getCdpTransferHook } from "./cdpTransferHook"
import { type CdpExecutionResult } from "./providers.types"
import { resolveCdpConfirmationDepth } from "./runtimeConfig"

const BASE_SEPOLIA_CHAIN_ID = 84532

const workosApiKey = secret("WORKOS_API_KEY")
const workosClientID = secret("WORKOS_CLIENT_ID")
const workosWebhookSecret = secret("WORKOS_WEBHOOK_SECRET")
const geminiApiKey = secret("GEMINI_API_KEY")
const cdpApiKeyID = secret("CDP_API_KEY_ID")
const cdpApiKeySecret = secret("CDP_API_KEY_SECRET")
const cdpApiKeyName = secret("CDP_API_KEY_NAME")
const cdpPrivateKey = secret("CDP_PRIVATE_KEY")
const cdpWalletSecret = secret("CDP_WALLET_SECRET")
const resendApiKey = secret("RESEND_API_KEY")
const resendFromEmail = secret("RESEND_FROM_EMAIL")
const notificationEmailTo = secret("NOTIFICATION_EMAIL_TO")
const slackWebhookURL = secret("SLACK_WEBHOOK_URL")

const workosIssuer = process.env.WORKOS_ISSUER?.trim() || "https://api.workos.com"
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview"

/** Preferred tenant when AuthKit/password flows omit org selection. */
export function defaultWorkOSOrganizationID(): string | undefined {
  const value =
    process.env.WORKOS_DEFAULT_ORGANIZATION_ID?.trim() ||
    process.env.WORKOS_ORGANIZATION_ID?.trim() ||
    // Staging PreBroadcast org — keeps JWT/org-less sessions tenant-bound.
    "org_01KZG3PR1SQX5EPF94709V0GD2"
  return value || undefined
}

export type { PaymentExecutionMode } from "./config"

export async function waitForTransferConfirmation(txHash: string) {
  const verification = await verifyLiveSettlement(txHash, undefined)
  if (verification.status === "PENDING") {
    throw APIError.failedPrecondition(`transaction not yet confirmed: ${txHash}`)
  }
  if (verification.status === "REVERTED") {
    throw APIError.failedPrecondition(`transaction reverted on-chain: ${txHash}`)
  }
  if (verification.status === "RECONCILIATION_REQUIRED") {
    throw APIError.failedPrecondition(
      `transaction confirmed but settlement facts mismatch: ${txHash}`,
    )
  }
  return verification
}

export interface SettlementVerificationRequest {
  txHash: string
  expected?: ExpectedTransferFacts
  demoSeed?: string
}

export async function verifySettlement(
  input: SettlementVerificationRequest,
): Promise<SettlementVerificationResult> {
  if (resolvePaymentMode() === "demo") {
    if (!input.demoSeed) {
      return { status: "RECONCILIATION_REQUIRED", reason: "missing_demo_seed" }
    }
    return verifyDemoSettlement(input.txHash, buildDemoTransactionHash(input.demoSeed))
  }
  return verifyLiveSettlement(input.txHash, input.expected)
}

async function verifyLiveSettlement(
  txHash: string,
  expected: ExpectedTransferFacts | undefined,
): Promise<SettlementVerificationResult> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    confirmations: resolveCdpConfirmationDepth(),
  })
  const blockNumber = await client.getBlockNumber()
  const confirmations = Number(blockNumber - receipt.blockNumber) + 1
  const transfers = parseErc20TransferLogs(
    receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics as readonly string[],
      data: log.data,
    })),
  )

  if (!expected) {
    if (receipt.status !== "success") {
      return { status: "REVERTED", reason: "transaction_reverted" }
    }
    return { status: "CONFIRMED" }
  }

  return verifyTransferFacts({
    receiptStatus: receipt.status,
    confirmations,
    requiredConfirmations: resolveCdpConfirmationDepth(),
    observedChainId: BASE_SEPOLIA_CHAIN_ID,
    transfers,
    expected,
  })
}

function hasLiveCdpCredentials(): boolean {
  const apiKeyID = cdpApiKeyID() || cdpApiKeyName()
  const apiKeySecret = cdpApiKeySecret() || cdpPrivateKey()
  return Boolean(apiKeyID && apiKeySecret && cdpWalletSecret())
}

export async function resolveCdpPayerAddress(organizationID: string): Promise<string> {
  if (resolvePaymentMode() === "demo") {
    return `0x${"11".repeat(20)}`
  }
  if (!hasLiveCdpCredentials()) {
    throw APIError.failedPrecondition("PAYMENT_MODE=live requires CDP credentials")
  }
  const cdp = new CdpClient({
    apiKeyId: cdpApiKeyID() || cdpApiKeyName(),
    apiKeySecret: cdpApiKeySecret() || cdpPrivateKey(),
    walletSecret: cdpWalletSecret(),
  })
  const account = await cdp.evm.getOrCreateAccount({
    name: `railguard-${safeIdentifier(organizationID)}`,
  })
  return account.address
}

type JsonObject = Record<string, unknown>

export interface VerifiedWorkOSToken {
  userID: string
  organizationID?: string
  role: AppRole
  permissions: string[]
}

export interface AuthURLResult {
  url: string
  state: string
  codeVerifier: string
}

export interface WorkOSExchangeResult {
  accessToken: string
  refreshToken: string
  sealedSession?: string
  organizationID?: string
  user: {
    id: string
    email: string
    firstName?: string
    lastName?: string
  }
}

export interface ExtractedInvoiceFields {
  vendorName?: string
  invoiceNumber?: string
  invoiceDate?: string
  dueDate?: string
  amountDecimal?: string
  token?: string
  chain?: string
  walletAddress?: string
  lineItemSummary?: string
  paymentMemo?: string
  extractionConfidence: number
  walletConfidence: number
  raw: JsonObject
}

export interface NotificationDeliveryInput {
  channel: "email" | "slack"
  organizationName: string
  subject: string
  body: string
  recipient?: string
}

let cachedWorkOS: WorkOS | null | undefined
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined

export function hasWorkOSConfig(): boolean {
  return Boolean(workosClientID() || workosApiKey())
}

export function isDevHeaderAuthEnabled(): boolean {
  if (process.env.ALLOW_DEV_HEADER_AUTH === "true") return true
  if (process.env.ALLOW_DEV_HEADER_AUTH === "false") return false
  return process.env.NODE_ENV !== "production"
}

function getWorkOS(): WorkOS {
  if (cachedWorkOS) return cachedWorkOS

  const apiKey = workosApiKey()
  const clientId = workosClientID()
  if (!apiKey && !clientId) {
    throw APIError.failedPrecondition("WorkOS is not configured")
  }

  cachedWorkOS = apiKey ? new WorkOS(apiKey, { clientId }) : new WorkOS({ clientId })
  return cachedWorkOS
}

async function getWorkOSJwks() {
  const clientId = workosClientID()
  if (!clientId) throw APIError.failedPrecondition("WORKOS_CLIENT_ID is not configured")
  if (!cachedJwks) {
    const workos = getWorkOS()
    const jwksUrl =
      typeof workos.userManagement.getJwksUrl === "function"
        ? workos.userManagement.getJwksUrl(clientId)
        : `https://api.workos.com/sso/jwks/${clientId}`
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl))
  }
  return cachedJwks
}

function workosIssuerCandidates(clientId: string): string[] {
  const configured = workosIssuer.replace(/\/$/, "")
  return Array.from(
    new Set([
      configured,
      `${configured}/`,
      "https://api.workos.com",
      "https://api.workos.com/",
      `https://api.workos.com/user_management/${clientId}`,
      `https://api.workos.com/user_management/${clientId}/`,
    ]),
  )
}

function mapWorkOSAuthResponse(response: {
  accessToken: string
  refreshToken: string
  sealedSession?: string | null
  organizationId?: string | null
  user: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  }
}): WorkOSExchangeResult {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    sealedSession: response.sealedSession ?? undefined,
    organizationID: response.organizationId ?? undefined,
    user: {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName ?? undefined,
      lastName: response.user.lastName ?? undefined,
    },
  }
}

function pendingAuthenticationTokenFromError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as Record<string, unknown>
  const direct = record.pendingAuthenticationToken ?? record.pending_authentication_token
  if (typeof direct === "string" && direct.length > 0) return direct
  const rawData = record.rawData
  if (rawData && typeof rawData === "object") {
    const nested = rawData as Record<string, unknown>
    const token = nested.pending_authentication_token ?? nested.pendingAuthenticationToken
    if (typeof token === "string" && token.length > 0) return token
  }
  return undefined
}

async function completeWithOrganizationSelection(input: {
  organizationID: string
  pendingAuthenticationToken: string
}): Promise<WorkOSExchangeResult> {
  const workos = getWorkOS()
  const response = await workos.userManagement.authenticateWithOrganizationSelection({
    clientId: workosClientID(),
    organizationId: input.organizationID,
    pendingAuthenticationToken: input.pendingAuthenticationToken,
  })
  return mapWorkOSAuthResponse(response)
}

export async function verifyWorkOSAccessToken(token: string): Promise<VerifiedWorkOSToken> {
  const clientId = workosClientID()
  if (!clientId) throw APIError.failedPrecondition("WORKOS_CLIENT_ID is not configured")

  const jwks = await getWorkOSJwks()
  // AuthKit access tokens often omit `aud` and put the app id in `client_id`.
  // Requiring `audience` here clears every browser session on the first API call.
  const { payload } = await jwtVerify(token, jwks, {
    issuer: workosIssuerCandidates(clientId),
  })

  const tokenClientID =
    typeof payload.client_id === "string"
      ? payload.client_id
      : typeof payload.aud === "string"
        ? payload.aud
        : Array.isArray(payload.aud)
          ? payload.aud.find((value): value is string => typeof value === "string")
          : undefined
  if (tokenClientID && tokenClientID !== clientId) {
    throw APIError.unauthenticated("WorkOS token client mismatch")
  }

  return {
    userID: String(payload.sub ?? ""),
    organizationID:
      typeof payload.org_id === "string" && payload.org_id.length > 0 ? payload.org_id : undefined,
    role: normalizeAppRole(typeof payload.role === "string" ? payload.role : undefined),
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.filter((value): value is string => typeof value === "string")
      : [],
  }
}

export async function getWorkOSAuthorizationURL(input: {
  redirectURI: string
  organizationID?: string
  provider?: "authkit" | "GoogleOAuth"
  screenHint?: "sign-in" | "sign-up"
  loginHint?: string
}): Promise<AuthURLResult> {
  const workos = getWorkOS()
  const provider = input.provider ?? "GoogleOAuth"
  // GoogleOAuth is an environment social connection. Passing organizationId makes WorkOS
  // look for an SSO Connection on that org and fails with organization_invalid.
  const organizationId =
    provider === "GoogleOAuth" ? undefined : input.organizationID ?? defaultWorkOSOrganizationID()

  return workos.userManagement.getAuthorizationUrlWithPKCE({
    provider,
    clientId: workosClientID(),
    redirectUri: input.redirectURI,
    ...(organizationId ? { organizationId } : {}),
    ...(provider === "authkit" && input.screenHint ? { screenHint: input.screenHint } : {}),
    ...(input.loginHint ? { loginHint: input.loginHint } : {}),
  })
}

export async function ensureWorkOSOrganizationMembership(input: {
  userID: string
  organizationID: string
  roleSlug?: string
}): Promise<void> {
  const workos = getWorkOS()
  const memberships = await workos.userManagement.listOrganizationMemberships({
    userId: input.userID,
    organizationId: input.organizationID,
  })
  const existing = memberships.data.find((membership) => membership.organizationId === input.organizationID)
  if (existing?.status === "active") return
  if (existing?.status === "inactive") {
    await workos.userManagement.reactivateOrganizationMembership(existing.id)
    return
  }

  try {
    await workos.userManagement.createOrganizationMembership({
      userId: input.userID,
      organizationId: input.organizationID,
      ...(input.roleSlug ? { roleSlug: input.roleSlug } : {}),
    })
  } catch (error) {
    const message = workosErrorMessage(error, "").toLowerCase()
    if (!message.includes("already") && !message.includes("conflict") && !message.includes("exists")) {
      throw error
    }
  }
}

export async function bindWorkOSSessionToOrganization(input: {
  accessToken: string
  refreshToken: string
  sealedSession?: string
  user: { id: string; email: string; firstName?: string; lastName?: string }
  organizationID?: string
}): Promise<WorkOSExchangeResult> {
  const organizationID = input.organizationID ?? defaultWorkOSOrganizationID()
  if (!organizationID) {
    return {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      sealedSession: input.sealedSession,
      organizationID: undefined,
      user: input.user,
    }
  }

  await ensureWorkOSOrganizationMembership({
    userID: input.user.id,
    organizationID,
  })

  try {
    const claims = decodeJwt(input.accessToken)
    if (typeof claims.org_id === "string" && claims.org_id === organizationID) {
      return {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        sealedSession: input.sealedSession,
        organizationID,
        user: input.user,
      }
    }
  } catch {
    // fall through to refresh
  }

  try {
    const refreshed = await refreshWorkOSSession({
      refreshToken: input.refreshToken,
      organizationID,
    })
    return {
      ...refreshed,
      organizationID: refreshed.organizationID ?? organizationID,
      user: refreshed.user.email ? refreshed.user : input.user,
    }
  } catch {
    return {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      sealedSession: input.sealedSession,
      organizationID,
      user: input.user,
    }
  }
}

export async function createWorkOSPasswordUser(input: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<{ id: string; email: string }> {
  const workos = getWorkOS()
  try {
    const user = await workos.userManagement.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      emailVerified: true,
      ...(input.firstName ? { firstName: input.firstName } : {}),
      ...(input.lastName ? { lastName: input.lastName } : {}),
    })
    return { id: user.id, email: user.email }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account"
    throw APIError.invalidArgument(message)
  }
}

export function workosErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : fallback
  }
  const record = error as Record<string, unknown>
  for (const key of ["message", "errorDescription", "error_description", "code", "error"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      if (key === "code" || key === "error") continue
      return value
    }
  }
  const rawData = record.rawData
  if (rawData && typeof rawData === "object") {
    const nested = rawData as Record<string, unknown>
    for (const key of ["message", "error_description", "error"]) {
      const value = nested[key]
      if (typeof value === "string" && value.trim() && key !== "error") return value
    }
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export async function exchangeWorkOSCode(input: {
  code: string
  redirectURI: string
  codeVerifier?: string
}): Promise<WorkOSExchangeResult> {
  const workos = getWorkOS()
  try {
    const response = await workos.userManagement.authenticateWithCode({
      code: input.code,
      codeVerifier: input.codeVerifier,
      clientId: workosClientID(),
      redirectUri: input.redirectURI,
    })
    return mapWorkOSAuthResponse(response)
  } catch (error) {
    const organizationID = defaultWorkOSOrganizationID()
    const pendingAuthenticationToken = pendingAuthenticationTokenFromError(error)
    if (organizationID && pendingAuthenticationToken) {
      return completeWithOrganizationSelection({ organizationID, pendingAuthenticationToken })
    }
    throw error
  }
}

export async function authenticateWorkOSPassword(input: {
  email: string
  password: string
  organizationID?: string
  ipAddress?: string
  userAgent?: string
}): Promise<WorkOSExchangeResult> {
  const workos = getWorkOS()
  const organizationID = input.organizationID ?? defaultWorkOSOrganizationID()
  try {
    const response = await workos.userManagement.authenticateWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      clientId: workosClientID(),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
    })
    const mapped = mapWorkOSAuthResponse(response)
    return mapped
  } catch (error) {
    const pendingAuthenticationToken = pendingAuthenticationTokenFromError(error)
    if (organizationID && pendingAuthenticationToken) {
      return completeWithOrganizationSelection({ organizationID, pendingAuthenticationToken })
    }
    throw error
  }
}

export async function refreshWorkOSSession(input: {
  refreshToken: string
  organizationID?: string
}): Promise<WorkOSExchangeResult> {
  const workos = getWorkOS()
  const organizationID = input.organizationID ?? defaultWorkOSOrganizationID()
  const response = await workos.userManagement.authenticateWithRefreshToken({
    clientId: workosClientID(),
    refreshToken: input.refreshToken,
    ...(organizationID ? { organizationId: organizationID } : {}),
  })
  return mapWorkOSAuthResponse(response)
}

export async function fetchWorkOSUser(userID: string) {
  const workos = getWorkOS()
  return workos.userManagement.getUser(userID)
}

export async function fetchWorkOSOrganization(organizationID: string) {
  const workos = getWorkOS()
  return workos.organizations.getOrganization(organizationID)
}

export async function createWorkOSOrganization(name: string) {
  const workos = getWorkOS()
  return workos.organizations.createOrganization({ name })
}

export async function verifyWorkOSWebhook(
  signatureHeader: string | undefined,
  payload: string,
): Promise<unknown> {
  if (!signatureHeader) throw APIError.invalidArgument("missing WorkOS signature header")
  const webhookSecret = workosWebhookSecret()
  if (!webhookSecret) throw APIError.failedPrecondition("WORKOS_WEBHOOK_SECRET is not configured")
  return getWorkOS().webhooks.constructEvent({
    payload,
    sigHeader: signatureHeader,
    secret: webhookSecret,
  })
}

export async function extractInvoiceDocument(input: {
  bytes: Buffer
  contentType: string
  fileName: string
}): Promise<ExtractedInvoiceFields> {
  if (!geminiApiKey()) {
    return heuristicExtraction(input)
  }

  const schema = {
    type: "OBJECT",
    properties: {
      vendorName: { type: "STRING" },
      invoiceNumber: { type: "STRING" },
      invoiceDate: { type: "STRING" },
      dueDate: { type: "STRING" },
      amountDecimal: { type: "STRING" },
      token: { type: "STRING" },
      chain: { type: "STRING" },
      walletAddress: { type: "STRING" },
      lineItemSummary: { type: "STRING" },
      paymentMemo: { type: "STRING" },
      extractionConfidence: { type: "NUMBER" },
      walletConfidence: { type: "NUMBER" },
    },
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey(),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Extract vendor payment invoice fields as strict JSON.",
                  "If a field is absent, omit it instead of guessing.",
                  "Normalize token to usdc when the document clearly refers to USDC.",
                  "Normalize chain to base-sepolia only when explicitly present or strongly implied.",
                  "Return confidence scores between 0 and 1.",
                ].join(" "),
              },
              {
                inlineData: {
                  mimeType: input.contentType,
                  data: input.bytes.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    },
  )

  if (!response.ok) {
    return heuristicExtraction(input)
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return heuristicExtraction(input)

  try {
    const parsed = JSON.parse(text) as JsonObject
    return normalizeExtractedFields(parsed)
  } catch {
    return heuristicExtraction(input)
  }
}

function normalizeExtractedFields(parsed: JsonObject): ExtractedInvoiceFields {
  return {
    vendorName: readString(parsed.vendorName),
    invoiceNumber: readString(parsed.invoiceNumber),
    invoiceDate: readString(parsed.invoiceDate),
    dueDate: readString(parsed.dueDate),
    amountDecimal: readString(parsed.amountDecimal),
    token: readString(parsed.token)?.toLowerCase(),
    chain: readString(parsed.chain)?.toLowerCase(),
    walletAddress: readString(parsed.walletAddress),
    lineItemSummary: readString(parsed.lineItemSummary),
    paymentMemo: readString(parsed.paymentMemo),
    extractionConfidence: clampConfidence(readNumber(parsed.extractionConfidence) ?? 0.85),
    walletConfidence: clampConfidence(readNumber(parsed.walletConfidence) ?? 0.9),
    raw: parsed,
  }
}

function heuristicExtraction(input: { bytes: Buffer; contentType: string; fileName: string }) {
  const text = input.bytes.toString(input.contentType === "application/pdf" ? "latin1" : "utf8")
  const compact = text.replace(/\s+/g, " ")
  const walletAddress = compact.match(/0x[a-fA-F0-9]{40}/)?.[0]
  const invoiceNumber =
    compact.match(/invoice(?:\s*(?:number|#|no\.?))?\s*[:#-]?\s*([A-Z0-9-]+)/i)?.[1] ??
    input.fileName.replace(/\.[^.]+$/, "")
  const amountMatch = compact.match(/([0-9]+(?:\.[0-9]{1,6})?)\s*(USDC|USD Coin|USD)/i)
  const vendorName = compact.match(
    /(?:from|vendor|bill to)\s*[:#-]?\s*([A-Za-z0-9 .,&-]{3,80})/i,
  )?.[1]

  const raw = {
    fileName: input.fileName,
    contentType: input.contentType,
    inferred: true,
  }

  return {
    vendorName,
    invoiceNumber,
    amountDecimal: amountMatch?.[1],
    token: amountMatch ? "usdc" : undefined,
    chain: BASE_SEPOLIA_CHAIN,
    walletAddress,
    extractionConfidence: walletAddress && amountMatch ? 0.82 : 0.7,
    walletConfidence: walletAddress ? 0.96 : 0.6,
    raw,
  }
}

export type { CdpExecutionResult } from "./providers.types"
export { setCdpTransferHookForTests } from "./cdpTransferHook"

export async function executeCdpTransfer(input: {
  organizationID: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
  paymentIntentId: string
  idempotencyKey: string
  providerIdempotencyKey: string
}): Promise<CdpExecutionResult> {
  const hook = getCdpTransferHook()
  if (hook) {
    const hooked = await hook(input)
    if (hooked === "DROP_RESPONSE") {
      throw new Error("CDP_RESPONSE_DROPPED")
    }
    return hooked
  }

  const mode = resolvePaymentMode()
  const demoSeed = [
    input.organizationID,
    input.paymentIntentId,
    input.providerIdempotencyKey,
    input.recipientAddress,
    input.amountBaseUnits,
    input.chain,
  ].join(":")

  if (mode === "demo") {
    return {
      txHash: buildDemoTransactionHash(demoSeed),
      mode: "demo",
    }
  }

  if (!hasLiveCdpCredentials()) {
    throw APIError.failedPrecondition("PAYMENT_MODE=live requires CDP credentials")
  }

  if (input.chain !== BASE_SEPOLIA_CHAIN) {
    throw APIError.failedPrecondition("live CDP execution is only configured for base-sepolia")
  }

  const apiKeyID = cdpApiKeyID() || cdpApiKeyName()
  const apiKeySecret = cdpApiKeySecret() || cdpPrivateKey()

  try {
    const cdp = new CdpClient({
      apiKeyId: apiKeyID,
      apiKeySecret,
      walletSecret: cdpWalletSecret(),
    })
    const account = await cdp.evm.getOrCreateAccount({
      name: `railguard-${safeIdentifier(input.organizationID)}`,
    })
    const { transactionHash } = await account.transfer({
      to: input.recipientAddress,
      amount: BigInt(input.amountBaseUnits),
      token: "usdc",
      network: "base-sepolia",
      idempotencyKey: input.providerIdempotencyKey,
    })

    return {
      txHash: transactionHash,
      mode: "live",
      accountAddress: account.address,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw APIError.failedPrecondition(`cdp transfer failed: ${message}`)
  }
}

export async function sendNotification(input: NotificationDeliveryInput): Promise<void> {
  if (input.channel === "email") {
    await sendResend(input)
    return
  }

  await sendSlack(input)
}

async function sendResend(input: NotificationDeliveryInput) {
  if (!resendApiKey() || !resendFromEmail()) return
  const recipients = [
    input.recipient?.trim(),
    ...notificationEmailTo()
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
  )
  if (recipients.length === 0) return

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail(),
      to: recipients,
      subject: `[${input.organizationName}] ${input.subject}`,
      text: input.body,
    }),
  })
}

async function sendSlack(input: NotificationDeliveryInput) {
  if (!slackWebhookURL()) return
  await fetch(slackWebhookURL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `*${input.organizationName}* - ${input.subject}\n${input.body}`,
    }),
  })
}

export function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function rejectIfUnsafeDocument(bytes: Buffer, fileName: string): void {
  const content = bytes.toString("latin1").toLowerCase()
  const markers = ["<script", "javascript:", "powershell", "cmd.exe", "vba", "shellcode"]
  if (markers.some((marker) => content.includes(marker))) {
    throw APIError.failedPrecondition(`document ${fileName} failed safety scan`)
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function clampConfidence(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function safeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
