/** Env helpers without Encore runtime — safe to import from unit tests. */

export function resolveCdpConfirmationDepth(): number {
  const raw = process.env.CDP_CONFIRMATION_DEPTH?.trim()
  if (!raw) return 1
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return n
}
