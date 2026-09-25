import { listEvmChainIds } from "@railguard/settlement/chains"
import { createSettlementVerifyRail } from "./settlementVerifyRail"
import { createAirwallexExecutionRail } from "./airwallexRail"
import { createStellarExecutionRail } from "./stellarRail"
import type { ExecutionRail } from "@railguard/kernel/executionRail"

export { createSettlementVerifyRail, createStellarExecutionRail, createAirwallexExecutionRail }

export function createEvmSettlementRails(): ExecutionRail[] {
  return listEvmChainIds()
    .filter((id) => id !== "base-sepolia")
    .map((id) => createSettlementVerifyRail(id))
}

export function createAllGrantRails(): ExecutionRail[] {
  return [...createEvmSettlementRails(), createStellarExecutionRail(), createAirwallexExecutionRail()]
}

export const INTEGRATION_PARTNERS = {
  agents: ["mcp", "coinbase-agentkit", "openclaw", "x402"],
  wallets: ["privy", "turnkey", "safe", "zerodev"],
  evmChains: listEvmChainIds(),
  risk: ["blockaid", "hypernative", "goplus", "chainlink-cre"],
  fiat: ["airwallex"],
  nonEvm: ["stellar"],
} as const
