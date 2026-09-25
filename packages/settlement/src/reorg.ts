import type { Hash, PublicClient } from "viem"

export interface BlockAnchor {
  blockNumber: bigint
  blockHash: Hash
}

export async function readBlockAnchorForTx(
  client: PublicClient,
  txHash: Hash,
): Promise<BlockAnchor | null> {
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  if (!receipt.blockNumber || !receipt.blockHash) return null
  return { blockNumber: receipt.blockNumber, blockHash: receipt.blockHash }
}

/** Returns false when the chain no longer has the same hash at that height (reorg). */
export async function blockAnchorStillValid(
  client: PublicClient,
  anchor: BlockAnchor,
): Promise<boolean> {
  const block = await client.getBlock({ blockNumber: anchor.blockNumber })
  if (!block.hash) return false
  return block.hash.toLowerCase() === anchor.blockHash.toLowerCase()
}

export type ReorgScanOutcome = "ok" | "reorg_detected" | "block_unavailable"

export async function scanBlockAnchor(
  client: PublicClient,
  anchor: BlockAnchor,
): Promise<ReorgScanOutcome> {
  try {
    const valid = await blockAnchorStillValid(client, anchor)
    return valid ? "ok" : "reorg_detected"
  } catch {
    return "block_unavailable"
  }
}
