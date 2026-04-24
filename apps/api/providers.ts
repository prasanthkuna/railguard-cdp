import { createHash } from "node:crypto"
import { CdpClient } from "@coinbase/cdp-sdk"
import { WorkOS } from "@workos-inc/node"
import { APIError } from "encore.dev/api"
import { secret } from "encore.dev/config"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { type AppRole, normalizeAppRole } from "../../packages/auth/src"
import { BASE_SEPOLIA_CHAIN, buildDemoTransactionHash } from "../../packages/cdp/src"

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
const slackWebhookURL = secret("SLACK_WEBHOOK_URL")

const workosIssuer = process.env.WORKOS_ISSUER?.trim() || "https://api.workos.com"
const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview"

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

let cachedWorkOS: WorkOS | null | undefined
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined

export function hasWorkOSConfig(): boolean {
  return Boolean(workosClientID() || workosApiKey())
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
}): Promise<CdpExecutionResult> {
  const apiKeyID = cdpApiKeyID() || cdpApiKeyName()
  const apiKeySecret = cdpApiKeySecret() || cdpPrivateKey()

  if (!apiKeyID || !apiKeySecret || !cdpWalletSecret()) {
    return {
      txHash: buildDemoTransactionHash(
        `${input.organizationID}:${input.recipientAddress}:${input.amountBaseUnits}`,
      ),
      mode: "demo",
    }
  }

  if (input.chain !== BASE_SEPOLIA_CHAIN) {
    throw APIError.failedPrecondition("live CDP execution is only configured for base-sepolia")
  }

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
}

export async function sendApprovalNotification(input: {
  organizationName: string
  subject: string
  body: string
}): Promise<void> {
  await Promise.all([sendResend(input), sendSlack(input)])
}

async function sendResend(input: { organizationName: string; subject: string; body: string }) {
  if (!resendApiKey() || !resendFromEmail()) return
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail(),
      to: [resendFromEmail()],
      subject: `[${input.organizationName}] ${input.subject}`,
      text: input.body,
    }),
  })
}

async function sendSlack(input: { organizationName: string; subject: string; body: string }) {
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
