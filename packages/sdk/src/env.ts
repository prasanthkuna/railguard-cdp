export interface RailguardEnv {
  baseUrl: string
  accessToken?: string
}

export function resolveRailguardEnv(overrides?: { baseUrl?: string }): RailguardEnv {
  const baseUrl =
    overrides?.baseUrl ??
    process.env.RAILGUARD_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000"

  const accessToken = process.env.RAILGUARD_ACCESS_TOKEN?.trim() || undefined

  return { baseUrl: baseUrl.replace(/\/$/, ""), accessToken }
}

export function requireToken(env: RailguardEnv): string {
  if (!env.accessToken) {
    throw new Error("RAILGUARD_ACCESS_TOKEN is required for authenticated API calls")
  }
  return env.accessToken
}

export function createClientFromEnv(overrides?: { baseUrl?: string }): {
  baseUrl: string
  getAuthHeaders: () => Record<string, string>
} {
  const env = resolveRailguardEnv(overrides)
  const token = env.accessToken
  return {
    baseUrl: env.baseUrl,
    getAuthHeaders: () => (token ? { authorization: `Bearer ${token}` } : {}),
  }
}
