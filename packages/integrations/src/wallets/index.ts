export * from "./types"
export { createPrivyWalletAdapter } from "./privy"
export { createTurnkeyWalletAdapter } from "./turnkey"
export { createSafeWalletAdapter } from "./safe"
export { createZeroDevWalletAdapter } from "./zerodev"

import type { WalletProviderAdapter } from "./types"
import { createPrivyWalletAdapter } from "./privy"
import { createSafeWalletAdapter } from "./safe"
import { createTurnkeyWalletAdapter } from "./turnkey"
import { createZeroDevWalletAdapter } from "./zerodev"

export function resolveWalletAdapter(): WalletProviderAdapter | null {
  const kind = process.env.RAILGUARD_WALLET_PROVIDER?.toLowerCase()
  switch (kind) {
    case "privy":
      return createPrivyWalletAdapter()
    case "turnkey":
      return createTurnkeyWalletAdapter()
    case "safe":
      return createSafeWalletAdapter()
    case "zerodev":
      return createZeroDevWalletAdapter()
    default:
      return null
  }
}
