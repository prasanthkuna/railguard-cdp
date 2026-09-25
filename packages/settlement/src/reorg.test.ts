import { describe, expect, test } from "bun:test"
import type { Hash, PublicClient } from "viem"
import { blockAnchorStillValid, scanBlockAnchor } from "./reorg"

function mockClient(blockHash: Hash): PublicClient {
  return {
    getBlock: async () => ({ hash: blockHash }),
  } as PublicClient
}

describe("reorg anchor", () => {
  test("detects hash mismatch as reorg", async () => {
    const anchor = {
      blockNumber: 100n,
      blockHash: "0xaaaa" as Hash,
    }
    const client = mockClient("0xbbbb" as Hash)
    expect(await blockAnchorStillValid(client, anchor)).toBe(false)
    expect(await scanBlockAnchor(client, anchor)).toBe("reorg_detected")
  })

  test("accepts matching hash", async () => {
    const anchor = {
      blockNumber: 100n,
      blockHash: "0xaaaa" as Hash,
    }
    const client = mockClient("0xaaaa" as Hash)
    expect(await scanBlockAnchor(client, anchor)).toBe("ok")
  })
})
