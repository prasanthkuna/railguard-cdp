import { Loader2 } from "lucide-react"
import * as React from "react"
import { cn } from "../../lib/cn"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary:
        "bg-[var(--rg-brand)] text-white hover:bg-[var(--rg-accent-hover)] shadow-[var(--rg-shadow-glow)]",
      accent:
        "bg-[var(--rg-brand)] text-white hover:bg-[var(--rg-accent-hover)] shadow-[var(--rg-shadow-glow)]",
      secondary:
        "border border-[var(--rg-border)] bg-[var(--rg-bg-base)] text-[var(--rg-text-primary)] hover:bg-[var(--rg-bg-hover)]",
      ghost: "text-[var(--rg-text-secondary)] hover:bg-[var(--rg-bg-hover)] hover:text-[var(--rg-text-primary)]",
      danger:
        "border border-[rgba(207,32,47,0.25)] bg-[var(--rg-bg-negative-wash)] text-[var(--rg-state-regret)] hover:bg-[rgba(207,32,47,0.08)]",
    }

    const sizes = {
      sm: "h-9 px-3.5 rg-caption normal-case",
      md: "h-10 px-4 rg-label-1",
      lg: "h-11 px-5 rg-label-1",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--rg-radius-pill)] font-semibold transition disabled:pointer-events-none disabled:opacity-45",
          variants[variant],
          sizes[size],
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    )
  },
)
Button.displayName = "Button"
