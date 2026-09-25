#!/usr/bin/env bun
/**
 * Base Sepolia CDP live smoke (testnet only). Requires PAYMENT_MODE=live and CDP secrets in .env.local
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { generateBaseSepoliaEvidence } from "../packages/settlement/src/base-sepolia.ts"

function loadEnv(file: string) {
  const path = join(process.cwd(), file)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#") || !t.includes("=")) continue
    const i = t.indexOf("=")
    const k = t.slice(0, i)
    const v = t.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv(".env")
loadEnv(".env.local")

const mode = process.env.PAYMENT_MODE ?? "demo"
const hasCdp =
  Boolean(process.env.CDP_API_KEY_ID?.trim()) &&
  Boolean(process.env.CDP_API_KEY_SECRET?.trim()) &&
  Boolean(process.env.CDP_WALLET_SECRET?.trim())

console.log("=== CDP Base Sepolia smoke (testnet) ===\n")
console.log(`PAYMENT_MODE=${mode}`)
console.log(`CDP credentials configured: ${hasCdp}`)

const evidence = await generateBaseSepoliaEvidence()
console.log(`\nSettlement verify (pinned tx): ${evidence.txHash} → ${evidence.settlement.status}`)

if (mode !== "live" || !hasCdp) {
  console.log("\nSKIP live CDP transfer — set PAYMENT_MODE=live and CDP_* in .env.local, then run API:")
  console.log("  encore run  # PAYMENT_MODE=live")
  console.log("  bun run verify:demo  # with RAILGUARD_BASE_URL=http://localhost:4000")
  process.exit(0)
}

console.log("\nLive CDP path: start Encore with PAYMENT_MODE=live and run bun run verify:demo")
process.exit(evidence.settlement.status === "CONFIRMED" ? 0 : 1)
