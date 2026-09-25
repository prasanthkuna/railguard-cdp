#!/usr/bin/env bun
/** One micro USDC transfer on Base Sepolia via CDP (testnet). Requires .env.local CDP_* */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CdpClient } from "@coinbase/cdp-sdk"
import { verifyEvmChainTx } from "../packages/settlement/src/evm-chain.ts"

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

const apiKeyId = process.env.CDP_API_KEY_ID?.trim()
const apiKeySecret = process.env.CDP_API_KEY_SECRET?.trim()
const walletSecret = process.env.CDP_WALLET_SECRET?.trim()

if (!apiKeyId || !apiKeySecret || !walletSecret) {
  console.error("Missing CDP_API_KEY_ID, CDP_API_KEY_SECRET, or CDP_WALLET_SECRET")
  process.exit(1)
}

const amount = BigInt(process.env.CDP_SMOKE_AMOUNT_BASE_UNITS ?? "1000")
const cdp = new CdpClient({ apiKeyId, apiKeySecret, walletSecret })
const account = await cdp.evm.getOrCreateAccount({ name: "railguard-smoke" })
const recipient = process.env.CDP_SMOKE_RECIPIENT?.trim() ?? account.address

console.log(`CDP live smoke: ${amount} base units → ${recipient} (self ok)`)

let transactionHash: string
try {
  const result = await account.transfer({
    to: recipient,
    amount,
    token: "usdc",
    network: "base-sepolia",
    idempotencyKey: `smoke-${Date.now()}`,
  })
  transactionHash = result.transactionHash
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes("exceeds balance") || msg.includes("insufficient")) {
    const outDir = join(process.cwd(), "evidence", "cdp-base-sepolia-live")
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      join(outDir, "manifest.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          network: "base-sepolia",
          status: "NEEDS_TESTNET_USDC",
          account: account.address,
          hint: "Fund CDP wallet with Base Sepolia USDC (faucet) then re-run bun run cdp-live-transfer-smoke",
        },
        null,
        2,
      )}\n`,
    )
    console.log("CDP credentials OK; wallet needs Base Sepolia USDC for micro-transfer smoke.")
    process.exit(0)
  }
  throw error
}

console.log(`tx: ${transactionHash}`)

const verification = await verifyEvmChainTx({
  chainId: "base-sepolia",
  txHash: transactionHash,
  requiredConfirmations: 1,
})

const out = {
  generatedAt: new Date().toISOString(),
  network: "base-sepolia",
  txHash: transactionHash,
  settlement: verification.status,
  confirmations: verification.confirmations,
}

const outDir = join(process.cwd(), "evidence", "cdp-base-sepolia-live")
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(out, null, 2)}\n`)

console.log(`Settlement: ${verification.status}`)
process.exit(verification.status === "CONFIRMED" ? 0 : 1)
