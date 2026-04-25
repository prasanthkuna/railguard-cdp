import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type, ...props }, ref) => {
    const generatedId = React.useId()
    const inputID = props.id ?? generatedId

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputID} className="text-sm font-medium text-[var(--rg-text-primary)]">
            {label}
          </label>
        )}
        <input
          id={inputID}
          type={type}
          className={`flex h-12 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--rg-text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rg-brand)] disabled:cursor-not-allowed disabled:opacity-50 ${error ? "border-[var(--rg-status-block)]" : ""} ${className || ""}`}
          ref={ref}
          {...props}
        />
        {error && <span className="text-xs text-[var(--rg-status-block)]">{error}</span>}
      </div>
    )
  },
)
Input.displayName = "Input"
