import {
  createTestnetEvmWalletAdapter,
  testnetSignDigest,
  testnetWalletConfigured,
} from "./testnetEvm"
import type { SignRequest, SignResult, WalletProviderAdapter } from "./types"

export function createTurnkeyWalletAdapter(): WalletProviderAdapter {
  if (process.env.RAILGUARD_TESTNET_WALLET === "1" && testnetWalletConfigured()) {
    return createTestnetEvmWalletAdapter("turnkey")
  }
  return {
    provider: "turnkey",
    async getAddress() {
      const addr = process.env.TURNKEY_WALLET_ADDRESS?.trim()
      if (!addr) throw new Error("TURNKEY_WALLET_ADDRESS not set")
      return addr
    },
    async sign(request: SignRequest): Promise<SignResult> {
      if (
        process.env.TURNKEY_API_PUBLIC_KEY?.trim() &&
        process.env.TURNKEY_API_PRIVATE_KEY?.trim()
      ) {
        return testnetSignDigest("turnkey", request.digest)
      }
      throw new Error("TURNKEY_API_PUBLIC_KEY and TURNKEY_API_PRIVATE_KEY required")
    },
  }
}
