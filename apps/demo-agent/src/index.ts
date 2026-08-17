/**
 * Demo agent — v5 metrics smoke test via REST.
 */
import { resolveRailguardEnv, requireToken } from "@railguard/sdk/env"

const env = resolveRailguardEnv()
const token = requireToken(env)

const res = await fetch(`${env.baseUrl}/v1/metrics/financial`, {
  headers: { authorization: `Bearer ${token}` },
})

const body = await res.text()
console.log(
  JSON.stringify(
    {
      ok: res.ok,
      baseUrl: env.baseUrl,
      metrics: res.ok ? JSON.parse(body) : body,
    },
    null,
    2,
  ),
)
