import { describe, expect, it } from "vitest"
import {
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_USDC,
  buildExpectedFromTransfer,
  discoverRecentUsdcTransfer,
  fetchSettlementFromTx,
  generateBaseSepoliaEvidence,
} from "./base-sepolia.js"

const RUN_LIVE = process.env.TESTNET_INTEGRATION === "1"
const PINNED_TX = process.env.BASE_SEPOLIA_TX_HASH

function requireFound(
  found: Awaited<ReturnType<typeof discoverRecentUsdcTransfer>>,
): NonNullable<Awaited<ReturnType<typeof discoverRecentUsdcTransfer>>> {
  if (!found) throw new Error("expected recent USDC transfer")
  return found
}

describe.skipIf(!RUN_LIVE)("Base Sepolia integration (live RPC)", () => {
  it("discovers a recent USDC transfer on chain", async () => {
    const found = requireFound(
      await discoverRecentUsdcTransfer({ lookbackBlocks: 20_000, maxBlockRange: 2000 }),
    )
    expect(found.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
    expect(found.transfer.tokenAddress.toLowerCase()).toBe(BASE_SEPOLIA_USDC.toLowerCase())
  }, 120_000)

  it("verifies transfer facts against a live receipt", async () => {
    const found = requireFound(
      await discoverRecentUsdcTransfer({ lookbackBlocks: 20_000, maxBlockRange: 2000 }),
    )
    const expected = buildExpectedFromTransfer(found.transfer)
    const result = await fetchSettlementFromTx({
      txHash: found.txHash,
      expected,
    })
    expect(result.status).toBe("CONFIRMED")
    expect(result.confirmations).toBeGreaterThanOrEqual(1)
    expect(expected.chainId).toBe(BASE_SEPOLIA_CHAIN_ID)
  }, 120_000)

  it("APF-004 wrong recipient triggers reconciliation on live receipt", async () => {
    const found = requireFound(
      await discoverRecentUsdcTransfer({ lookbackBlocks: 20_000, maxBlockRange: 2000 }),
    )
    const expected = buildExpectedFromTransfer(found.transfer)
    const wrong = {
      ...expected,
      recipient: "0x000000000000000000000000000000000000dead",
    }
    const result = await fetchSettlementFromTx({
      txHash: found.txHash,
      expected: wrong,
    })
    expect(result.status).toBe("RECONCILIATION_REQUIRED")
    expect(result.reason).toBe("transfer_facts_mismatch")
  }, 120_000)

  it("generates grant-ready evidence bundle", async () => {
    const evidence = await generateBaseSepoliaEvidence({
      txHash: PINNED_TX,
    })
    expect(evidence.network).toBe("base-sepolia")
    expect(evidence.settlement.status).toBe("CONFIRMED")
    expect(evidence.explorerUrl).toContain("sepolia.basescan.org")
  }, 120_000)
})
