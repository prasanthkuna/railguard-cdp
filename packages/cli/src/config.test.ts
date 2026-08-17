import { describe, expect, test } from "bun:test"
import { resolveRailguardEnv, requireToken } from "@railguard/sdk/env"

describe("@railguard/cli config", () => {
  test("resolveRailguardEnv defaults", () => {
    const prev = process.env.RAILGUARD_BASE_URL
    delete process.env.RAILGUARD_BASE_URL
    const env = resolveRailguardEnv()
    expect(env.baseUrl).toBe("http://localhost:4000")
    if (prev) process.env.RAILGUARD_BASE_URL = prev
  })

  test("requireToken throws when missing", () => {
    expect(() => requireToken({ baseUrl: "http://localhost:4000" })).toThrow(
      "RAILGUARD_ACCESS_TOKEN",
    )
  })
})
