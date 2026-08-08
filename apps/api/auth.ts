import { APIError, Gateway, type Header } from "encore.dev/api"
import { authHandler } from "encore.dev/auth"
import { type AuthenticatedActor, isAppRole, normalizeAppRole } from "../../packages/auth/src"
import { db } from "./db"
import {
  defaultWorkOSOrganizationID,
  hasWorkOSConfig,
  isDevHeaderAuthEnabled,
  verifyWorkOSAccessToken,
} from "./providers"

interface AuthParams {
  authorization: Header<"Authorization">
  organizationID?: Header<"X-Organization-Id">
  role?: Header<"X-Role">
  userID?: Header<"X-User-Id">
  email?: Header<"X-User-Email">
}

export type AuthData = AuthenticatedActor

async function resolveOrganizationID(input: {
  userID: string
  tokenOrganizationID?: string
  headerOrganizationID?: string
}): Promise<string | undefined> {
  if (input.tokenOrganizationID) return input.tokenOrganizationID

  const row = await db.queryRow<{ organization_id: string }>`
    SELECT organization_id
    FROM users
    WHERE id = ${input.userID} OR workos_user_id = ${input.userID}
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (row?.organization_id) return row.organization_id

  const headerOrg = input.headerOrganizationID?.trim()
  if (headerOrg) {
    const membership = await db.queryRow<{ organization_id: string }>`
      SELECT organization_id
      FROM users
      WHERE (id = ${input.userID} OR workos_user_id = ${input.userID})
        AND organization_id = ${headerOrg}
      LIMIT 1
    `
    if (membership?.organization_id) return membership.organization_id
  }

  return defaultWorkOSOrganizationID()
}

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const token = params.authorization?.replace(/^Bearer\s+/i, "").trim()
  const devHeaderAuthEnabled = isDevHeaderAuthEnabled()
  if (!token) {
    throw APIError.unauthenticated("missing bearer token")
  }

  const looksLikeJwt = token.split(".").length === 3
  if (hasWorkOSConfig() && looksLikeJwt) {
    try {
      const verified = await verifyWorkOSAccessToken(token)
      if (!verified.userID) {
        throw APIError.unauthenticated("WorkOS token missing subject")
      }

      const organizationID = await resolveOrganizationID({
        userID: verified.userID,
        tokenOrganizationID: verified.organizationID,
        headerOrganizationID: params.organizationID,
      })
      if (!organizationID) {
        throw APIError.unauthenticated(
          "WorkOS token must include organization context; tenant headers are not accepted",
        )
      }

      // WorkOS JWTs often carry org role "member", which maps to viewer. Prefer the
      // local app role (set to owner on first login) so operators keep write access.
      const localUser = await db.queryRow<{ role: string }>`
        SELECT role FROM users
        WHERE organization_id = ${organizationID}
          AND (id = ${verified.userID} OR workos_user_id = ${verified.userID})
        ORDER BY created_at ASC
        LIMIT 1
      `
      const role =
        localUser?.role && isAppRole(localUser.role) ? localUser.role : verified.role

      return {
        userID: verified.userID,
        organizationID,
        role,
        email: params.email?.trim(),
      }
    } catch (error) {
      // Never fall through to header auth for JWT bearers — that minted fake user IDs
      // from truncated tokens and collided on (org, email), returning 500s to the UI.
      if (error instanceof APIError) throw error
      throw APIError.unauthenticated("invalid bearer token")
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
