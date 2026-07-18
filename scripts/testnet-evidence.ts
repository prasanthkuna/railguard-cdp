#!/usr/bin/env bun
/**
 * Base Sepolia live settlement evidence — read-only RPC verification.
 *
 * Usage:
 *   bun run scripts/testnet-evidence.ts
 *   BASE_SEPOLIA_TX_HASH=0x... bun run scripts/testnet-evidence.ts
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { generateBaseSepoliaEvidence } from "../packages/settlement/src/base-sepolia.ts"

const evidenceDir = join(import.meta.dir, "..", "evidence")

function serializeEvidence(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  )
}

async function main(): Promise<void> {
  mkdirSync(evidenceDir, { recursive: true })

  const evidence = await generateBaseSepoliaEvidence({
    txHash: process.env.BASE_SEPOLIA_TX_HASH,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
  })

  const bundle = {
    ...evidence,
    ok: evidence.settlement.status === "CONFIRMED",
  }

  const outPath = join(evidenceDir, "base-sepolia-live.json")
  writeFileSync(outPath, serializeEvidence(bundle))
  console.log(serializeEvidence(bundle))

  if (!bundle.ok) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
