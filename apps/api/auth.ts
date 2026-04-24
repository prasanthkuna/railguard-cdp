import { APIError, Gateway, Header } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";

type AppRole = "owner" | "finance" | "approver" | "viewer";

interface AuthParams {
  authorization: Header<"Authorization">;
  organizationID?: Header<"X-Organization-Id">;
  role?: Header<"X-Role">;
  userID?: Header<"X-User-Id">;
  email?: Header<"X-User-Email">;
}

export interface AuthData {
  userID: string;
  organizationID: string;
  role: AppRole;
  email?: string;
}

const roles = new Set<AppRole>(["owner", "finance", "approver", "viewer"]);

export const auth = authHandler<AuthParams, AuthData>(async (params) => {
  const token = params.authorization?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw APIError.unauthenticated("missing bearer token");
  }

  if (!params.organizationID) {
    throw APIError.unauthenticated("missing X-Organization-Id header");
  }

  const role = roles.has(params.role as AppRole) ? (params.role as AppRole) : "viewer";

  return {
    userID: params.userID?.trim() || token.slice(0, 128),
    organizationID: params.organizationID.trim(),
    role,
    email: params.email?.trim(),
  };
});

export const gateway = new Gateway({ authHandler: auth });
