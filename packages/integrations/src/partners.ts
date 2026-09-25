/** Static partner matrix for posture API (no settlement graph). */

export const INTEGRATION_PARTNERS = {
  agents: ["mcp", "coinbase-agentkit", "openclaw", "x402"],
  wallets: ["privy", "turnkey", "safe", "zerodev"],
  evmChains: [
    "base-sepolia",
    "arbitrum-sepolia",
    "monad-testnet",
    "arc-testnet",
    "celo-alfajores",
    "arbitrum",
    "arc",
    "celo",
  ],
  risk: ["blockaid", "hypernative", "goplus", "chainlink-cre"],
  fiat: ["airwallex"],
  nonEvm: ["stellar"],
} as const
