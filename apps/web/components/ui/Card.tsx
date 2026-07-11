import * as React from "react"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "dark" | "stat"
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const baseStyles = "rounded-[var(--rg-radius-lg)] p-6 transition-all"

    const variants = {
      default:
        "bg-[var(--rg-surface-light)] border border-[var(--rg-border)] shadow-[var(--rg-shadow-sm)]",
      dark: "bg-[var(--rg-surface-card-dark)] text-white [--rg-text-primary:var(--rg-text-inverse)] [--rg-text-muted:#b9c1cf] [--rg-border:rgba(255,255,255,0.2)]",
      stat: "bg-[var(--rg-surface-light)] border border-[var(--rg-border)] flex flex-col justify-center",
    }

    return (
      <div ref={ref} className={`${baseStyles} ${variants[variant]} ${className || ""}`} {...props}>
        {children}
      </div>
    )
  },
)
Card.displayName = "Card"

export function CardHeader({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1.5 mb-4 ${className || ""}`}>{children}</div>
}

export function CardTitle({
  children,
  className,
}: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={`text-2xl font-sans font-semibold leading-none tracking-tight ${className || ""}`}
    >
      {children}
    </h3>
  )
}
