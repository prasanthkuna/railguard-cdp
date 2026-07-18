import { createHash } from "node:crypto"
import { CdpClient } from "@coinbase/cdp-sdk"
import { WorkOS } from "@workos-inc/node"
import { APIError } from "encore.dev/api"
import { secret } from "encore.dev/config"
import { createRemoteJWKSet, jwtVerify } from "jose"
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

export interface CdpExecutionResult {
  txHash: string
  mode: "live" | "demo"
  accountAddress?: string
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
    cachedJwks = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`))
  }
  return cachedJwks
}

export async function verifyWorkOSAccessToken(token: string): Promise<VerifiedWorkOSToken> {
  const jwks = await getWorkOSJwks()
  const { payload } = await jwtVerify(token, jwks, {
    issuer: workosIssuer,
    audience: workosClientID(),
  })

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
}): Promise<AuthURLResult> {
  const workos = getWorkOS()
  return workos.userManagement.getAuthorizationUrlWithPKCE({
    provider: "authkit",
    clientId: workosClientID(),
    redirectUri: input.redirectURI,
    organizationId: input.organizationID,
  })
}

export async function exchangeWorkOSCode(input: {
  code: string
  redirectURI: string
  codeVerifier?: string
}): Promise<WorkOSExchangeResult> {
  const workos = getWorkOS()
  const response = await workos.userManagement.authenticateWithCode({
    code: input.code,
    codeVerifier: input.codeVerifier,
    clientId: workosClientID(),
    redirectUri: input.redirectURI,
  })

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    sealedSession: response.sealedSession,
    organizationID: response.organizationId,
    user: {
      id: response.user.id,
      email: response.user.email,
      firstName: response.user.firstName ?? undefined,
      lastName: response.user.lastName ?? undefined,
    },
  }
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

export async function executeCdpTransfer(input: {
  organizationID: string
  recipientAddress: string
  amountBaseUnits: string
  chain: string
  paymentIntentId: string
  idempotencyKey: string
}): Promise<CdpExecutionResult> {
  const mode = resolvePaymentMode()
  const demoSeed = [
    input.organizationID,
    input.paymentIntentId,
    input.idempotencyKey,
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
