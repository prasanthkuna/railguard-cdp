import { Inbox } from "lucide-react"
import type * as React from "react"
import { cn } from "../../lib/cn"

export interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--rg-radius-lg)] border border-dashed border-[var(--rg-border)] bg-[var(--rg-bg-panel)] px-4 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 rounded-full bg-[var(--rg-bg-hover)] p-4 ring-1 ring-[var(--rg-border)]">
        {icon || <Inbox className="h-8 w-8 text-[var(--rg-text-muted)]" />}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[var(--rg-text-primary)]">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-[var(--rg-text-muted)]">{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  )
}
