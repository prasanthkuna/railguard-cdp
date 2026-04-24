import { describe, expect, test } from "bun:test"
import { buildAuditHash, stableStringify } from "./index"

describe("audit helpers", () => {
  test("stableStringify sorts object keys recursively", () => {
    const result = stableStringify({ b: 2, a: { d: 4, c: 3 } })
    expect(result).toBe('{"a":{"c":3,"d":4},"b":2}')
  })

  test("buildAuditHash is deterministic for identical input", () => {
    const input = {
      eventID: "aud_1",
      entityType: "invoice",
      entityID: "inv_1",
      eventType: "invoice.created",
      event: { amount: "1000000" },
      previousHash: "prev_hash",
    }

    expect(buildAuditHash(input)).toBe(buildAuditHash(input))
  })
})
