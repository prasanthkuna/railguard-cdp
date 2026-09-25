import type { WalletProviderAdapter } from "./types"

/** ZeroDev — ERC-4337 session keys (env: ZERODEV_PROJECT_ID). */
export function createZeroDevWalletAdapter(): WalletProviderAdapter {
  return {
    provider: "zerodev",
    async getAddress() {
      const addr = process.env.ZERODEV_ACCOUNT_ADDRESS?.trim()
      if (!addr) throw new Error("ZERODEV_ACCOUNT_ADDRESS not set")
      return addr
    },
    async sign() {
      throw new Error("ZeroDev signing: use session key validator + Railguard policy")
    },
  }
}
