export interface DevIdentity {
  organizationID: string
  userID: string
  role: "owner" | "finance" | "approver" | "viewer"
  email: string
  token: string
}

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  sealedSession?: string
  organizationID?: string
  userID: string
  email: string
}

const DEFAULT_DEV_ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || "org_demo_rollout"

const DEFAULT_IDENTITY: DevIdentity = {
  organizationID: DEFAULT_DEV_ORG_ID,
  userID: "usr_demo",
  role: "owner",
  email: "admin@demo.railguard",
  token: "demo-token",
}

const AUTH_SESSION_KEY = "railguard_auth_session"
const WORKOS_STATE_KEY = "railguard_workos_state"
const WORKOS_CODE_VERIFIER_KEY = "railguard_workos_code_verifier"

export function isDevAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH !== "false"
}

function normalizeDevIdentity(identity: DevIdentity): DevIdentity {
  if (!identity.organizationID?.trim() || identity.organizationID === "org_demo") {
    return {
      ...identity,
      organizationID: DEFAULT_DEV_ORG_ID,
    }
  }

  return identity
}

export function getDevIdentity(): DevIdentity {
  if (typeof window === "undefined") return DEFAULT_IDENTITY
  try {
    const stored = localStorage.getItem("railguard_identity")
    if (!stored) return DEFAULT_IDENTITY

    const rawIdentity = JSON.parse(stored) as DevIdentity
    const parsed = normalizeDevIdentity(rawIdentity)
    if (parsed.organizationID !== rawIdentity.organizationID) {
      localStorage.setItem("railguard_identity", JSON.stringify(parsed))
    }
    return parsed
  } catch {
    return DEFAULT_IDENTITY
  }
}

export function setDevIdentity(identity: DevIdentity) {
  if (typeof window !== "undefined") {
    localStorage.setItem("railguard_identity", JSON.stringify(identity))
  }
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY)
    return stored ? (JSON.parse(stored) as AuthSession) : null
  } catch {
    return null
  }
}

export function hasAuthSession(): boolean {
  return Boolean(getAuthSession()?.accessToken)
}

export function setAuthSession(session: AuthSession) {
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
  }
}

export function clearAuthSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_SESSION_KEY)
  }
}

export function setWorkOSAuthFlow(state: string, codeVerifier: string) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(WORKOS_STATE_KEY, state)
    sessionStorage.setItem(WORKOS_CODE_VERIFIER_KEY, codeVerifier)
  }
}

export function getWorkOSAuthFlow() {
  if (typeof window === "undefined") return null

  const state = sessionStorage.getItem(WORKOS_STATE_KEY)
  const codeVerifier = sessionStorage.getItem(WORKOS_CODE_VERIFIER_KEY)
  if (!state || !codeVerifier) return null

  return { state, codeVerifier }
}

export function clearWorkOSAuthFlow() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(WORKOS_STATE_KEY)
    sessionStorage.removeItem(WORKOS_CODE_VERIFIER_KEY)
  }
}

export function getAuthHeaders(): HeadersInit {
  if (isDevAuthEnabled()) {
    const identity = getDevIdentity()
    return {
      "X-Organization-Id": identity.organizationID,
      "X-User-Id": identity.userID,
      "X-Role": identity.role,
      "X-User-Email": identity.email,
      Authorization: `Bearer ${identity.token}`,
      "Content-Type": "application/json",
    }
  }

  const session = getAuthSession()
  return {
    ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    "Content-Type": "application/json",
  }
}
