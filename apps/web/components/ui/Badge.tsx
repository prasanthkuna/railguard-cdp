import * as React from "react"
import { cn } from "../../lib/cn"
import { statusColor, statusLabel, statusToneClass } from "../../lib/format"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string
  variant?: "solid" | "outline" | "dot"
}

const badgeType = "inline-flex items-center rounded-[var(--rg-radius-pill)] px-2.5 py-0.5 rg-caption normal-case"

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, status, variant = "solid", ...props }, ref) => {
    const color = statusColor(status)
    const label = statusLabel(status)
    const tone = statusToneClass(status)

    if (variant === "solid") {
      return (
        <span ref={ref} className={cn(badgeType, "ring-1", tone, className)} {...props}>
          {label}
        </span>
      )
    }

    if (variant === "outline") {
      return (
        <span
          ref={ref}
          className={cn(badgeType, "ring-1", className)}
          style={{ color, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}` }}
          {...props}
        >
          {label}
        </span>
      )
    }

    return (
      <span
        ref={ref}
        className={cn(
          badgeType,
          "bg-[var(--rg-bg-hover)] text-[var(--rg-text-secondary)]",
          className,
        )}
        {...props}
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
    )
  },
)
Badge.displayName = "Badge"
