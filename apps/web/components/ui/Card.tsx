import * as React from "react"
import { cn } from "../../lib/cn"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "panel"
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-[var(--rg-radius-lg)]",
          variant === "glass" && "rg-glass p-5 md:p-6",
          variant === "panel" && "rg-panel p-5 md:p-6",
          variant === "default" && "rg-card p-5 md:p-6",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
Card.displayName = "Card"

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn("rg-headline text-[var(--rg-text-primary)]", className)}>
      {children}
    </h3>
  )
}
