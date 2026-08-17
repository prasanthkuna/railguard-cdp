import * as React from "react"
import { formatDateTime, humanizeEventType, statusColor } from "../../lib/format"
import { cn } from "../../lib/cn"
import type { AuditEvent } from "../../lib/types"

function summarizeEvent(event: Record<string, unknown>): string | null {
  const keys = ["status", "result", "decision", "reason", "message", "action"]
  for (const key of keys) {
    const value = event[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-[var(--rg-text-muted)]">No audit events found.</p>
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const summary = event.event ? summarizeEvent(event.event as Record<string, unknown>) : null
        const accent = statusColor(
          (event.event as Record<string, string> | undefined)?.result ||
            (event.event as Record<string, string> | undefined)?.status ||
            "info",
        )

        return (
          <div key={event.id} className="relative pl-7 pb-6 last:pb-0">
            {index !== events.length - 1 ? (
              <div className="absolute bottom-0 left-[11px] top-6 w-px bg-[var(--rg-border)]" />
            ) : null}

            <div
              className="absolute left-0 top-1.5 h-[22px] w-[22px] rounded-full border-2 border-[var(--rg-bg-base)] bg-[var(--rg-bg-primary-wash)]"
              style={{ boxShadow: `inset 0 0 0 4px ${accent}` }}
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--rg-text-primary)]">
                  {humanizeEventType(event.eventType)}
                </p>
                <time className="text-xs text-[var(--rg-text-muted)]">{formatDateTime(event.createdAt)}</time>
              </div>

              {summary ? <p className="mt-1 text-sm text-[var(--rg-text-secondary)]">{summary}</p> : null}

              <p className="mt-1 font-mono text-[11px] text-[var(--rg-text-muted)]">
                {event.eventHash.slice(0, 10)}…{event.eventHash.slice(-8)}
              </p>

              {event.event && Object.keys(event.event).length > 0 ? (
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-xs font-medium text-[var(--rg-brand)] hover:underline">
                    View payload
                  </summary>
                  <pre
                    className={cn(
                      "mt-2 max-h-48 overflow-auto rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-alternate)] p-3 text-[11px] leading-relaxed text-[var(--rg-text-secondary)]",
                    )}
                  >
                    {JSON.stringify(event.event, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
