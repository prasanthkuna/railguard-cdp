#!/usr/bin/env bun
/**
 * Arbitrum Sepolia live settlement evidence — read-only RPC verification.
 *
 * Usage:
 *   ARBITRUM_SEPOLIA_TX_HASH=0x... bun run scripts/arbitrum-sepolia-evidence.ts
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { generateArbitrumSepoliaEvidence } from "../packages/settlement/src/arbitrum-sepolia.ts"

const evidenceDir = join(import.meta.dir, "..", "evidence", "arbitrum-sepolia")

function serializeEvidence(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  )
}

async function main(): Promise<void> {
  mkdirSync(evidenceDir, { recursive: true })

  const evidence = await generateArbitrumSepoliaEvidence({
    txHash: process.env.ARBITRUM_SEPOLIA_TX_HASH,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
  })

  const bundle = {
    ...evidence,
    ok: evidence.settlement.status === "CONFIRMED",
  }

  const outPath = join(evidenceDir, "manifest.json")
  writeFileSync(outPath, serializeEvidence(bundle))
  writeFileSync(join(evidenceDir, "README.md"), buildReadme(bundle))
  console.log(serializeEvidence(bundle))

  if (!bundle.ok) {
    process.exit(1)
  }
}

function buildReadme(bundle: {
  txHash: string
  explorerUrl: string
  chainId: number
  settlement: { status: string }
}): string {
  return `# Arbitrum Sepolia — settlement evidence

| Field | Value |
|-------|-------|
| Network | Arbitrum Sepolia |
| Chain ID | ${bundle.chainId} |
| Tx hash | \`${bundle.txHash}\` |
| Explorer | ${bundle.explorerUrl} |
| Settlement | ${bundle.settlement.status} |

## Reproduce

\`\`\`powershell
cd coinbase
$env:ARBITRUM_SEPOLIA_TX_HASH="${bundle.txHash}"
bun run arbitrum-sepolia-evidence
\`\`\`
`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
