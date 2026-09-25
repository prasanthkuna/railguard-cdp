import type { WalletProviderAdapter } from "./types"

export function createTurnkeyWalletAdapter(): WalletProviderAdapter {
  return {
    provider: "turnkey",
    async getAddress() {
      const addr = process.env.TURNKEY_WALLET_ADDRESS?.trim()
      if (!addr) throw new Error("TURNKEY_WALLET_ADDRESS not set")
      return addr
    },
    async sign() {
      throw new Error("Turnkey signing: wire @turnkey/sdk-server in your deployment")
    },
  }
}
