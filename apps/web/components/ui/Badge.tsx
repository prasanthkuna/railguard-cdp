import * as React from "react"
import { statusColor, statusLabel } from "../../lib/format"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string
  variant?: "solid" | "outline" | "dot"
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, status, variant = "solid", ...props }, ref) => {
    const color = statusColor(status)
    const label = statusLabel(status)

    const baseStyles =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans transition-colors"

    const style =
      variant === "solid"
        ? { backgroundColor: color, color: "white" }
        : variant === "outline"
          ? { border: `1px solid ${color}`, color }
          : { color: "var(--rg-text-primary)", backgroundColor: "var(--rg-surface-secondary)" }

    return (
      <span ref={ref} className={`${baseStyles} ${className || ""}`} style={style} {...props}>
        {variant === "dot" && (
          <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: color }} />
        )}
        {label}
      </span>
    )
  },
)
Badge.displayName = "Badge"
