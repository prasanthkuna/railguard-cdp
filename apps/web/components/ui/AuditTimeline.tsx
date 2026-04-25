import * as React from "react"
import { formatDate } from "../../lib/format"
import type { AuditEvent } from "../../lib/types"

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (!events || events.length === 0)
    return <p className="text-sm text-[var(--rg-text-muted)]">No audit events found.</p>

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="relative pl-6 pb-4">
          {/* Vertical line */}
          {index !== events.length - 1 && (
            <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--rg-border)]" />
          )}

          {/* Dot */}
          <div className="absolute left-1.5 top-2 h-2.5 w-2.5 rounded-full bg-[var(--rg-brand)] ring-4 ring-[var(--rg-surface-light)]" />

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--rg-text-primary)]">
                {event.eventType}
              </span>
              <span className="text-xs text-[var(--rg-text-muted)]">
                {formatDate(event.createdAt)}
              </span>
            </div>
            <p className="text-xs text-[var(--rg-text-muted)] font-mono">
              hash: {event.eventHash.slice(0, 16)}...
            </p>
            {event.event && Object.keys(event.event).length > 0 && (
              <div className="mt-2 rounded-md bg-[var(--rg-surface-secondary)] p-2">
                <pre className="text-xs text-[var(--rg-text-muted)] whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(event.event, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
