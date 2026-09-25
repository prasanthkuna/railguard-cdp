#!/usr/bin/env bun
/**
 * Run all testnet RPC + settlement checks (plan §6 environment rule).
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { generateArbitrumSepoliaEvidence } from "../packages/settlement/src/arbitrum-sepolia.ts"
import { generateBaseSepoliaEvidence } from "../packages/settlement/src/base-sepolia.ts"
import {
  EVM_CHAINS,
  OPTIONAL_TESTNET_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
} from "../packages/settlement/src/chains.ts"
import { createEvmPublicClient } from "../packages/settlement/src/evm-rpc.ts"
import { defineChain } from "viem"

type Row = { chain: string; check: string; ok: boolean; detail?: string }

const rows: Row[] = []

function log(row: Row) {
  rows.push(row)
  const mark = row.ok ? "PASS" : "FAIL"
  console.log(`[${mark}] ${row.chain} — ${row.check}${row.detail ? `: ${row.detail}` : ""}`)
}

async function rpcPing(chainId: string): Promise<void> {
  const desc = EVM_CHAINS[chainId]
  if (!desc) {
    log({ chain: chainId, check: "registry", ok: false, detail: "unknown" })
    return
  }
  const chain = defineChain({
    id: desc.chainId,
    name: desc.name,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [...desc.rpcUrls] } },
  })
  let ok = false
  let detail = ""
  for (const url of desc.rpcUrls) {
    try {
      const client = createEvmPublicClient(chain, url)
      const block = await client.getBlockNumber()
      ok = true
      detail = `block=${block} via ${url}`
      break
    } catch (e) {
      detail = e instanceof Error ? e.message : String(e)
    }
  }
  log({ chain: chainId, check: "rpc_ping", ok, detail })
}

async function main(): Promise<void> {
  console.log("=== Railguard testnet matrix ===\n")

  console.log("--- Testnet RPC pings (required) ---\n")
  for (const id of TESTNET_CHAIN_IDS) {
    await rpcPing(id)
  }
  console.log("\n--- Optional testnet RPC pings ---\n")
  for (const id of OPTIONAL_TESTNET_CHAIN_IDS) {
    await rpcPing(id)
  }

  console.log("\n--- Mainnet RPC pings (informational) ---\n")
  for (const id of ["arbitrum", "arc", "celo"]) {
    await rpcPing(id)
  }

  console.log("\n=== Base Sepolia settlement evidence ===\n")
  try {
    const baseTx =
      process.env.BASE_SEPOLIA_TX_HASH ??
      "0x80cac8ed62ca6ef0797f1a6244ab52e13e6c39ea23f3a0fa58e2fa95623872dd"
    const base = await generateBaseSepoliaEvidence({ txHash: baseTx })
    log({
      chain: "base-sepolia",
      check: "settlement_verify",
      ok: base.settlement.status === "CONFIRMED",
      detail: base.txHash,
    })
  } catch (e) {
    log({
      chain: "base-sepolia",
      check: "settlement_verify",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    })
  }

  console.log("\n=== Arbitrum Sepolia settlement evidence ===\n")
  try {
    const arb = await generateArbitrumSepoliaEvidence({
      txHash: process.env.ARBITRUM_SEPOLIA_TX_HASH,
    })
    log({
      chain: "arbitrum-sepolia",
      check: "settlement_verify",
      ok: arb.settlement.status === "CONFIRMED",
      detail: arb.txHash,
    })
  } catch (e) {
    log({
      chain: "arbitrum-sepolia",
      check: "settlement_verify",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    })
  }

  const out = join(import.meta.dir, "..", "evidence", "testnet-matrix.json")
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2))
  console.log(`\nWrote ${out}`)

  const requiredChains = new Set<string>([...TESTNET_CHAIN_IDS, "base-sepolia", "arbitrum-sepolia"])
  const failed = rows.filter(
    (r) =>
      !r.ok &&
      (requiredChains.has(r.chain) ||
        r.check === "settlement_verify"),
  )
  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed`)
    process.exit(1)
  }
  console.log("\nAll testnet checks passed")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
