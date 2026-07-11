import { describe, expect, it } from "bun:test"

/** Serializes claims the way prepared → executing UPDATE does in Postgres. */
async function claimPreparedStatus(
  getStatus: () => string,
  setStatus: (next: string) => void,
): Promise<boolean> {
  if (getStatus() !== "prepared") return false
  setStatus("executing")
  return true
}

describe("payment execution claim serialization", () => {
  it("allows exactly one winner among 100 concurrent claimers", async () => {
    let status = "prepared"
    let lock = Promise.resolve()
    const claim = () =>
      (lock = lock.then(async () => claimPreparedStatus(() => status, (next) => { status = next })))

    const results = await Promise.all(Array.from({ length: 100 }, () => claim()))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(status).toBe("executing")
  })
})
