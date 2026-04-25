import { Loader2 } from "lucide-react"
import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "primary", size = "md", isLoading, children, disabled, ...props },
    ref,
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none"

    const variants = {
      primary:
        "bg-[var(--rg-brand)] text-white hover:bg-[var(--rg-brand-hover)] rounded-[var(--rg-radius-pill)]",
      secondary:
        "bg-[var(--rg-surface-secondary)] text-[var(--rg-text-primary)] hover:bg-[var(--rg-border)] rounded-[var(--rg-radius-pill)]",
      ghost:
        "bg-transparent text-[var(--rg-text-muted)] hover:text-[var(--rg-text-primary)] hover:bg-[var(--rg-surface-secondary)] rounded-[var(--rg-radius-pill)]",
      danger:
        "bg-[var(--rg-status-block)] text-white hover:opacity-90 rounded-[var(--rg-radius-pill)]",
    }

    const sizes = {
      sm: "h-8 px-4 text-sm",
      md: "h-14 px-8 text-base", // 56px height per Coinbase
      lg: "h-16 px-10 text-lg",
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ""}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  },
)
Button.displayName = "Button"
