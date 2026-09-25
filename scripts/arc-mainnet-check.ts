#!/usr/bin/env bun
/**
 * Arc microgrant readiness — verifies RPC + documents deploy checklist.
 * Set ARC_RPC_URL and ARC_DEPLOYER_KEY before mainnet deploy.
 */
import { getEvmChain } from "../packages/settlement/src/chains"

const arc = getEvmChain("arc")
console.log(JSON.stringify({ chainId: arc.chainId, rpc: arc.rpcUrls[0], checklist: [
  "Deploy minimal Railguard verify UI or contract",
  "Public repo link",
  "Submit Arc Microgrant form",
]}, null, 2))
