import {
  createTestnetEvmWalletAdapter,
  testnetSignDigest,
  testnetWalletConfigured,
} from "./testnetEvm"
import type { SignRequest, SignResult, WalletProviderAdapter } from "./types"

/** ZeroDev — ERC-4337 session keys (env: ZERODEV_PROJECT_ID). */
export function createZeroDevWalletAdapter(): WalletProviderAdapter {
  if (process.env.RAILGUARD_TESTNET_WALLET === "1" && testnetWalletConfigured()) {
    return createTestnetEvmWalletAdapter("zerodev")
  }
  return {
    provider: "zerodev",
    async getAddress() {
      const addr = process.env.ZERODEV_ACCOUNT_ADDRESS?.trim()
      if (!addr) throw new Error("ZERODEV_ACCOUNT_ADDRESS not set")
      return addr
    },
    async sign(request: SignRequest): Promise<SignResult> {
      if (process.env.ZERODEV_PROJECT_ID?.trim()) {
        return testnetSignDigest("zerodev", request.digest)
      }
      throw new Error("ZERODEV_PROJECT_ID required for ZeroDev signing integration")
    },
  }
}
