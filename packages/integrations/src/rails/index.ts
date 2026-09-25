import type { ExecutionRail } from "@railguard/kernel/executionRail"
import { listEvmChainIds } from "@railguard/settlement/chains"
import { createAirwallexExecutionRail } from "./airwallexRail"
import { createSettlementVerifyRail } from "./settlementVerifyRail"
import { createStellarExecutionRail } from "./stellarRail"

export { createSettlementVerifyRail, createStellarExecutionRail, createAirwallexExecutionRail }

export function createEvmSettlementRails(): ExecutionRail[] {
  return listEvmChainIds()
    .filter((id) => id !== "base-sepolia")
    .map((id) => createSettlementVerifyRail(id))
}

export function createAllGrantRails(): ExecutionRail[] {
  return [
    ...createEvmSettlementRails(),
    createStellarExecutionRail(),
    createAirwallexExecutionRail(),
  ]
}

export { INTEGRATION_PARTNERS } from "../partners"
