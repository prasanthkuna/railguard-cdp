export function formatUsdcLabel(baseUnits: string | undefined): string {
  if (!baseUnits) return "NONE"
  const n = Number(baseUnits)
  if (!Number.isFinite(n) || n <= 0) return "NONE"
  return `$${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
}
