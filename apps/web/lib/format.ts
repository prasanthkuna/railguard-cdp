export function formatUSDC(baseUnits: string | number): string {
  try {
    const val = typeof baseUnits === "string" ? BigInt(baseUnits) : BigInt(Math.floor(baseUnits))
    const decimal = Number(val) / 1000000
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(decimal)} USDC`
  } catch {
    return "0.00 USDC"
  }
}

export function formatAddress(address?: string): string {
  if (!address) return "Unknown"
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatDate(iso?: string): string {
  if (!iso) return "N/A"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatConfidence(value?: number): string {
  if (value === undefined || value === null) return "N/A"
  return `${Math.round(value * 100)}%`
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    received: "Received",
    ready: "Ready",
    needs_approval: "Needs Approval",
    blocked: "Blocked",
    approved: "Approved",
    rejected: "Rejected",
    payment_intent_created: "Payment Created",
    executed: "Executed",
    allow: "Allow",
    escalate: "Escalate",
    pending: "Pending",
  }
  return map[status] || status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function statusColor(status: string): string {
  switch (status) {
    case "allow":
    case "approved":
    case "executed":
      return "var(--rg-status-allow)"
    case "block":
    case "blocked":
    case "rejected":
      return "var(--rg-status-block)"
    case "escalate":
    case "needs_approval":
      return "var(--rg-status-escalate)"
    case "ready":
    case "payment_intent_created":
      return "var(--rg-status-info)"
    default:
      return "var(--rg-text-muted)"
  }
}
