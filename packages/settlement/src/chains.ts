/** EVM chain registry for settlement verification rails (plan §16 P2). */

export interface EvmChainDescriptor {
  id: string
  name: string
  chainId: number
  rpcUrls: readonly string[]
  explorerTxUrl: (hash: string) => string
  usdcAddress?: string
  /** CDP execution available (Base Sepolia only today). */
  cdpExecution: boolean
}

export const EVM_CHAINS: Record<string, EvmChainDescriptor> = {
  "base-sepolia": {
    id: "base-sepolia",
    name: "Base Sepolia",
    chainId: 84532,
    rpcUrls: ["https://sepolia.base.org"],
    explorerTxUrl: (h) => `https://sepolia.basescan.org/tx/${h}`,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    cdpExecution: true,
  },
  "arbitrum-sepolia": {
    id: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    rpcUrls: [
      "https://sepolia-rollup.arbitrum.io/rpc",
      "https://arb-sepolia.g.alchemy.com/v2/demo",
    ],
    explorerTxUrl: (h) => `https://sepolia.arbiscan.io/tx/${h}`,
    usdcAddress: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
    cdpExecution: false,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    rpcUrls: ["https://arb1.arbitrum.io/rpc"],
    explorerTxUrl: (h) => `https://arbiscan.io/tx/${h}`,
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    cdpExecution: false,
  },
  "monad-testnet": {
    id: "monad-testnet",
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    explorerTxUrl: (h) => `https://testnet.monadexplorer.com/tx/${h}`,
    usdcAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    cdpExecution: false,
  },
  "arc-testnet": {
    id: "arc-testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrls: ["https://rpc.testnet.arc.io", "https://rpc.drpc.testnet.arc.io"],
    explorerTxUrl: (h) => `https://testnet.arcscan.app/tx/${h}`,
    cdpExecution: false,
  },
  arc: {
    id: "arc",
    name: "Arc Mainnet",
    chainId: 5042,
    rpcUrls: ["https://rpc.mainnet.arc.io"],
    explorerTxUrl: (h) => `https://explorer.arc.io/tx/${h}`,
    cdpExecution: false,
  },
  "celo-alfajores": {
    id: "celo-alfajores",
    name: "Celo Alfajores",
    chainId: 44787,
    rpcUrls: [
      "https://alfajores-forno.celo-testnet.org",
      "https://celo-alfajores.public.blastapi.io",
    ],
    explorerTxUrl: (h) => `https://alfajores.celoscan.io/tx/${h}`,
    cdpExecution: false,
  },
  celo: {
    id: "celo",
    name: "Celo Mainnet",
    chainId: 42220,
    rpcUrls: ["https://forno.celo.org"],
    explorerTxUrl: (h) => `https://celoscan.io/tx/${h}`,
    cdpExecution: false,
  },
}

/** Testnets used in CI / `bun run testnet:all` */
export const TESTNET_CHAIN_IDS = [
  "base-sepolia",
  "arbitrum-sepolia",
  "monad-testnet",
  "arc-testnet",
] as const

/** Pinged when reachable; does not fail `testnet:all` */
export const OPTIONAL_TESTNET_CHAIN_IDS = ["celo-alfajores"] as const

export function getEvmChain(id: string): EvmChainDescriptor {
  const chain = EVM_CHAINS[id]
  if (!chain) throw new Error(`unknown EVM chain: ${id}`)
  return chain
}

export function listEvmChainIds(): string[] {
  return Object.keys(EVM_CHAINS)
}
