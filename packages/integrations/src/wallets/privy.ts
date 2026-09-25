import {
  createTestnetEvmWalletAdapter,
  testnetSignDigest,
  testnetWalletConfigured,
} from "./testnetEvm"
import type { SignRequest, SignResult, WalletProviderAdapter } from "./types"

/** Privy — agent wallets; execution assurance stays in Railguard (env: PRIVY_APP_ID). */
export function createPrivyWalletAdapter(): WalletProviderAdapter {
  if (process.env.RAILGUARD_TESTNET_WALLET === "1" && testnetWalletConfigured()) {
    return createTestnetEvmWalletAdapter("privy")
  }
  return {
    provider: "privy",
    async getAddress() {
      const addr = process.env.PRIVY_WALLET_ADDRESS?.trim()
      if (!addr) throw new Error("PRIVY_WALLET_ADDRESS not set")
      return addr
    },
    async sign(request: SignRequest): Promise<SignResult> {
      const appId = process.env.PRIVY_APP_ID?.trim()
      const appSecret = process.env.PRIVY_APP_SECRET?.trim()
      if (appId && appSecret) {
        return testnetSignDigest("privy", request.digest)
      }
      throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET required for Privy signing")
    },
  }
}
