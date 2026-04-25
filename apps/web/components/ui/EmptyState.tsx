import { Inbox } from "lucide-react"
import type * as React from "react"

export interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--rg-border)] rounded-[var(--rg-radius-lg)] bg-[var(--rg-surface-subtle)]">
      <div className="bg-[var(--rg-surface-secondary)] p-4 rounded-full mb-4">
        {icon || <Inbox className="h-8 w-8 text-[var(--rg-text-muted)]" />}
      </div>
      <h3 className="text-lg font-semibold text-[var(--rg-text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--rg-text-muted)] max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
