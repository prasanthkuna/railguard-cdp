import { describe, expect, it } from "bun:test"

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
    const claim = async () => {
      const prior = lock
      let release!: () => void
      lock = new Promise<void>((resolve) => {
        release = resolve
      })
      await prior
      try {
        return await claimPreparedStatus(
          () => status,
          (next) => {
            status = next
          },
        )
      } finally {
        release()
      }
    }

    const results = await Promise.all(Array.from({ length: 100 }, () => claim()))
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(status).toBe("executing")
  })
})
