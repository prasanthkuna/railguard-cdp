import type { WalletProviderAdapter } from "./types"

/** Safe — on-chain ENFORCE mode companion (env: SAFE_ADDRESS). */
export function createSafeWalletAdapter(): WalletProviderAdapter {
  return {
    provider: "safe",
    async getAddress() {
      const addr = process.env.SAFE_ADDRESS?.trim()
      if (!addr) throw new Error("SAFE_ADDRESS not set")
      return addr
    },
    async sign() {
      throw new Error("Safe signing: use Safe Protocol Kit + Railguard hook module")
    },
  }
}
