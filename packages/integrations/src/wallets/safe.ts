import {
  createTestnetEvmWalletAdapter,
  testnetSignDigest,
  testnetWalletConfigured,
} from "./testnetEvm"
import type { SignRequest, SignResult, WalletProviderAdapter } from "./types"

/** Safe — on-chain ENFORCE mode companion (env: SAFE_ADDRESS). */
export function createSafeWalletAdapter(): WalletProviderAdapter {
  if (process.env.RAILGUARD_TESTNET_WALLET === "1" && testnetWalletConfigured()) {
    return createTestnetEvmWalletAdapter("safe")
  }
  return {
    provider: "safe",
    async getAddress() {
      const addr = process.env.SAFE_ADDRESS?.trim()
      if (!addr) throw new Error("SAFE_ADDRESS not set")
      return addr
    },
    async sign(request: SignRequest): Promise<SignResult> {
      if (process.env.SAFE_TX_SERVICE_URL?.trim()) {
        return testnetSignDigest("safe", request.digest)
      }
      throw new Error("SAFE_TX_SERVICE_URL required for Safe signing integration")
    },
  }
}
