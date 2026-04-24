export type AppRole = "owner" | "finance" | "approver" | "viewer"

export const appRoles: AppRole[] = ["owner", "finance", "approver", "viewer"]

export interface AuthenticatedActor {
  userID: string
  organizationID: string
  role: AppRole
  email?: string
}

export function isAppRole(value: string | undefined): value is AppRole {
  return appRoles.includes((value ?? "") as AppRole)
}

export function hasRequiredRole(
  actor: Pick<AuthenticatedActor, "role">,
  allowedRoles?: readonly AppRole[],
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true
  }

  return allowedRoles.includes(actor.role)
}
