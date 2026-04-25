import { APIError, Gateway, type Header } from "encore.dev/api"
import { authHandler } from "encore.dev/auth"
import { type AuthenticatedActor, isAppRole, normalizeAppRole } from "../../packages/auth/src"
import { hasWorkOSConfig, isDevHeaderAuthEnabled, verifyWorkOSAccessToken } from "./providers"

interface AuthParams {
  authorization: Header<"Authorization">
  organizationID?: Header<"X-Organization-Id">
  role?: Header<"X-Role">
  userID?: Header<"X-User-Id">
  email?: Header<"X-User-Email">
}

export type AuthData = AuthenticatedActor

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const token = params.authorization?.replace(/^Bearer\s+/i, "").trim()
  const devHeaderAuthEnabled = isDevHeaderAuthEnabled()
  if (!token) {
    throw APIError.unauthenticated("missing bearer token")
  }

  if (hasWorkOSConfig() && token.split(".").length === 3) {
    try {
      const verified = await verifyWorkOSAccessToken(token)
      const organizationID = verified.organizationID ?? params.organizationID?.trim()
      if (!organizationID) {
        throw APIError.unauthenticated("missing WorkOS organization context")
      }

      return {
        userID: verified.userID,
        organizationID,
        role: verified.role,
        email: params.email?.trim(),
      }
    } catch (error) {
      if (!devHeaderAuthEnabled || !params.organizationID) {
        throw APIError.unauthenticated("invalid bearer token")
      }
    }
  }

  if (!devHeaderAuthEnabled) {
    if (hasWorkOSConfig()) {
      throw APIError.unauthenticated("missing valid WorkOS bearer token")
    }
    throw APIError.failedPrecondition(
      "dev header auth is disabled; configure WorkOS or enable ALLOW_DEV_HEADER_AUTH",
    )
  }

  if (!params.organizationID) {
    throw APIError.unauthenticated("missing X-Organization-Id header")
  }

  const role = isAppRole(params.role) ? params.role : normalizeAppRole(params.role)
  return {
    userID: params.userID?.trim() || token.slice(0, 128),
    organizationID: params.organizationID.trim(),
    role,
    email: params.email?.trim(),
  }
})

export const gateway = new Gateway({ authHandler: auth })
