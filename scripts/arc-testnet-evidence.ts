#!/usr/bin/env bun
/** Arc testnet readiness — RPC ping + optional contract deploy checklist (no mainnet). */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createPublicClientForEvmChain } from "../packages/settlement/src/evm-chain.ts"

const outDir = join(process.cwd(), "evidence", "arc-testnet")
const manifest = {
  generatedAt: new Date().toISOString(),
  network: "arc-testnet",
  chainId: 5042002,
  rpc: "https://rpc.testnet.arc.io",
  deployChecklist: [
    "Set DEPLOYER_PRIVATE_KEY (testnet faucet funded)",
    "Set ACCOUNT_OWNER and RAILGUARD_SIGNER (distinct addresses)",
    "cd ../railguard-new/contracts && forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast",
  ],
  rpcPing: { ok: false as boolean, block: "" },
}

try {
  const client = await createPublicClientForEvmChain("arc-testnet")
  const block = await client.getBlockNumber()
  manifest.rpcPing = { ok: true, block: block.toString() }
  console.log(`[PASS] arc-testnet block=${block}`)
} catch (error) {
  console.log(`[FAIL] arc-testnet: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Wrote ${join(outDir, "manifest.json")}`)
