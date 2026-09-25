import type { SignRequest, SignResult, WalletProviderAdapter } from "./types"

/** Privy — agent wallets; execution assurance stays in Railguard (env: PRIVY_APP_ID). */
export function createPrivyWalletAdapter(): WalletProviderAdapter {
  return {
    provider: "privy",
    async getAddress() {
      const addr = process.env.PRIVY_WALLET_ADDRESS?.trim()
      if (!addr) throw new Error("PRIVY_WALLET_ADDRESS not set")
      return addr
    },
    async sign(_request: SignRequest): Promise<SignResult> {
      if (!process.env.PRIVY_APP_ID?.trim()) {
        throw new Error("PRIVY_APP_ID not set — use Privy server SDK to sign")
      }
      throw new Error("Privy signing: wire @privy-io/server-auth in your deployment")
    },
  }
}
