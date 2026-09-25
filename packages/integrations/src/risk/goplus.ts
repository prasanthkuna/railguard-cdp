import type { RiskSignalInput, RiskSignalProvider, RiskSignalResult } from "./types"

/** GoPlus — address security API (public token optional). */
export function createGoPlusRiskProvider(): RiskSignalProvider {
  return {
    name: "goplus",
    async evaluate(input: RiskSignalInput): Promise<RiskSignalResult> {
      const appKey = process.env.GOPLUS_APP_KEY?.trim()
      if (!appKey) {
        return { provider: "goplus", level: "UNKNOWN", labels: ["provider_not_configured"] }
      }
      try {
        const url = `https://api.gopluslabs.io/api/v1/address_security/${input.chainId}?contract_addresses=${input.to}`
        const res = await fetch(url, { headers: { Authorization: appKey } })
        if (!res.ok) {
          return { provider: "goplus", level: "UNKNOWN", labels: [`http_${res.status}`] }
        }
        const json = (await res.json()) as Record<string, unknown>
        return { provider: "goplus", level: "LOW", labels: ["fetched"], raw: json }
      } catch {
        return { provider: "goplus", level: "UNKNOWN", labels: ["fetch_failed"] }
      }
    },
  }
}
