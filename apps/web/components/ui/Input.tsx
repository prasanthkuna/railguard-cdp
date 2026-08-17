import * as React from "react"
import { cn } from "../../lib/cn"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, type, ...props }, ref) => {
    const generatedId = React.useId()
    const inputID = props.id ?? generatedId

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputID} className="rg-label-1 text-[var(--rg-text-primary)]">
            {label}
          </label>
        ) : null}
        <input
          id={inputID}
          type={type}
          className={cn(
            "flex h-11 w-full rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-base)] px-3.5 py-2 rg-body text-[var(--rg-text-primary)] shadow-sm transition placeholder:text-[var(--rg-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-accent-glow)] focus-visible:border-[var(--rg-brand-muted)] disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-[var(--rg-state-regret)] focus-visible:ring-[rgba(207,32,47,0.15)]",
            className,
          )}
          ref={ref}
          {...props}
        />
        {hint && !error ? <span className="rg-legal text-[var(--rg-text-muted)]">{hint}</span> : null}
        {error ? <span className="rg-legal text-[var(--rg-state-regret)]">{error}</span> : null}
      </div>
    )
  },
)
Input.displayName = "Input"

export function SelectField({
  label,
  id,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generatedId = React.useId()
  const selectID = id ?? generatedId

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectID} className="rg-label-1 text-[var(--rg-text-primary)]">
          {label}
        </label>
      ) : null}
      <select
        id={selectID}
        className={cn(
          "flex h-11 w-full rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-base)] px-3.5 py-2 rg-body text-[var(--rg-text-primary)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-accent-glow)] focus-visible:border-[var(--rg-brand-muted)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function TextAreaField({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const generatedId = React.useId()
  const areaID = props.id ?? generatedId

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label htmlFor={areaID} className="rg-label-1 text-[var(--rg-text-primary)]">
          {label}
        </label>
      ) : null}
      <textarea
        id={areaID}
        className={cn(
          "flex min-h-[96px] w-full rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-base)] px-3.5 py-2.5 rg-body text-[var(--rg-text-primary)] placeholder:text-[var(--rg-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rg-accent-glow)] focus-visible:border-[var(--rg-brand-muted)]",
          className,
        )}
        {...props}
      />
    </div>
  )
}
