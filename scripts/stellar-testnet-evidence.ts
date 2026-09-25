#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  STELLAR_TESTNET_EVIDENCE_TX,
  verifyStellarTestnetPayment,
} from "../packages/settlement/src/stellar-testnet.ts"

const outDir = join(process.cwd(), "evidence", "stellar-testnet")
mkdirSync(outDir, { recursive: true })

const result = await verifyStellarTestnetPayment({
  txHash: STELLAR_TESTNET_EVIDENCE_TX,
  expectedDestination: "GB2VOBJNNP4ZC3LNJBDJ6CMD3PC2FJFI24MOCE4W6LDMVPSCMYYN6NIG",
  expectedAmount: "1.0000000",
  expectedMemo: "PI:pi-testnet-evidence",
})

const manifest = {
  generatedAt: new Date().toISOString(),
  network: "stellar-testnet",
  transaction_hash: STELLAR_TESTNET_EVIDENCE_TX,
  status: result.status,
  facts: result.facts,
  reason: result.reason,
}

writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Stellar testnet verify: ${result.status}`)
process.exit(result.status === "CONFIRMED" ? 0 : 1)
