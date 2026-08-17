import { RailguardClient } from "@railguard/sdk"
import { type RailguardEnv, requireToken } from "./config"

export function createClient(env: RailguardEnv, auth = true): RailguardClient {
  const token = auth ? requireToken(env) : env.accessToken
  return new RailguardClient({
    baseUrl: env.baseUrl,
    getAuthHeaders: () =>
      token ? { authorization: `Bearer ${token}` } : {},
  })
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return text ? (JSON.parse(text) as T) : ({} as T)
}
