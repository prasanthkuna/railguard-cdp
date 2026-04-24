import { createHash } from "node:crypto"

export interface AuditEvent {
  id: string
  eventType: string
  entityType: string
  entityId: string
}

export interface AuditHashInput {
  eventID: string
  entityType: string
  entityID: string
  eventType: string
  event: Record<string, unknown>
  previousHash?: string | null
}

export function buildAuditHash(input: AuditHashInput): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex")
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}
