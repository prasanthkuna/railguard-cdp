import { afterEach, describe, expect, it } from "bun:test"
import { resolveCdpConfirmationDepth } from "./runtimeConfig"

describe("resolveCdpConfirmationDepth", () => {
  const prior = process.env.CDP_CONFIRMATION_DEPTH

  afterEach(() => {
    if (prior === undefined) process.env.CDP_CONFIRMATION_DEPTH = undefined
    else process.env.CDP_CONFIRMATION_DEPTH = prior
  })

  it("defaults to 1 when unset", () => {
    process.env.CDP_CONFIRMATION_DEPTH = undefined
    expect(resolveCdpConfirmationDepth()).toBe(1)
  })

  it("parses positive integer from env", () => {
    process.env.CDP_CONFIRMATION_DEPTH = "3"
    expect(resolveCdpConfirmationDepth()).toBe(3)
  })

  it("falls back to 1 for invalid values", () => {
    process.env.CDP_CONFIRMATION_DEPTH = "0"
    expect(resolveCdpConfirmationDepth()).toBe(1)
    process.env.CDP_CONFIRMATION_DEPTH = "bad"
    expect(resolveCdpConfirmationDepth()).toBe(1)
  })
})
