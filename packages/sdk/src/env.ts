export interface RailguardEnv {
  baseUrl: string
  accessToken?: string
}

function readEnvBaseUrl(): string | undefined {
  for (const key of ["RAILGUARD_BASE_URL", "NEXT_PUBLIC_API_URL"] as const) {
    const raw = process.env[key]?.trim()
    if (!raw || raw === "undefined") continue
    return raw
  }
  return undefined
}

export function resolveRailguardEnv(overrides?: { baseUrl?: string }): RailguardEnv {
  const baseUrl = overrides?.baseUrl ?? readEnvBaseUrl() ?? "http://localhost:4000"

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
