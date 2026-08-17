import type * as React from "react"
import { cn } from "../../lib/cn"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--rg-radius-md)] bg-[var(--rg-bg-hover)] ring-1 ring-[var(--rg-border)]",
        className,
      )}
      {...props}
    />
  )
}
