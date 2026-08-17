import { ArrowLeft, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "../../lib/cn"

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rg-label-2 text-[var(--rg-text-muted)] transition hover:text-[var(--rg-brand)]"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="rg-caption text-[var(--rg-brand)]">{eyebrow}</p>
        ) : null}
        <h1 className="rg-title-1 tracking-tight text-[var(--rg-text-primary)] md:text-cds-display-3 md:leading-[var(--lineHeight-display3)] md:font-normal">
          {title}
        </h1>
        {description ? (
          <p className="rg-body max-w-2xl text-[var(--rg-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: "neutral" | "calm" | "caution" | "regret" | "joy" | "info"
  icon?: LucideIcon
}) {
  const toneStyles = {
    neutral: {
      icon: "text-[var(--rg-text-secondary)]",
      wash: "bg-[var(--rg-bg-hover)]",
      glow: "var(--rg-status-neutral)",
    },
    calm: {
      icon: "text-[var(--rg-brand)]",
      wash: "bg-[var(--rg-bg-primary-wash)]",
      glow: "var(--rg-brand)",
    },
    caution: {
      icon: "text-[var(--rg-state-caution)]",
      wash: "bg-[var(--rg-bg-warning-wash)]",
      glow: "var(--rg-state-caution)",
    },
    regret: {
      icon: "text-[var(--rg-state-regret)]",
      wash: "bg-[var(--rg-bg-negative-wash)]",
      glow: "var(--rg-state-regret)",
    },
    joy: {
      icon: "text-[var(--rg-state-joy)]",
      wash: "bg-[var(--rg-bg-positive-wash)]",
      glow: "var(--rg-state-joy)",
    },
    info: {
      icon: "text-[var(--rg-brand)]",
      wash: "bg-[var(--rg-bg-primary-wash)]",
      glow: "var(--rg-brand)",
    },
  }

  const style = toneStyles[tone]

  return (
    <div className="rg-card group relative overflow-hidden p-5 transition hover:shadow-[var(--rg-shadow-md)]">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl"
        style={{ background: style.glow }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="rg-caption text-[var(--rg-text-muted)]">{label}</p>
          <p className="rg-title-1 mt-2 tracking-tight text-[var(--rg-text-primary)]">{value}</p>
          {hint ? <p className="rg-legal mt-2 text-[var(--rg-text-muted)]">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn("rounded-[var(--rg-radius-md)] p-2.5", style.wash)}>
            <Icon className={cn("h-5 w-5", style.icon)} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function HeroMetric({
  label,
  value,
  sub,
  accent = "brand",
}: {
  label: string
  value: ReactNode
  sub?: string
  accent?: "accent" | "brand" | "caution"
}) {
  const colors = {
    accent: "rg-wash-blue",
    brand: "rg-wash-blue",
    caution: "bg-[var(--rg-bg-warning-wash)] border-[rgba(207,71,14,0.18)]",
  }

  return (
    <div className={cn("relative overflow-hidden rounded-[var(--rg-radius-xl)] p-6 md:p-8", colors[accent])}>
      <p className="rg-caption text-[var(--rg-brand)]">{label}</p>
      <p className="rg-display-3 mt-3 tracking-tight text-[var(--rg-text-primary)]">{value}</p>
      {sub ? <p className="rg-body mt-3 max-w-md text-[var(--rg-text-muted)]">{sub}</p> : null}
    </div>
  )
}

export function FilterTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = value === tab.value
        return (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "rg-label-2 rounded-[var(--rg-radius-pill)] px-4 py-2 transition",
              active
                ? "bg-[var(--rg-brand)] text-white shadow-[var(--rg-shadow-glow)]"
                : "border border-[var(--rg-border)] bg-[var(--rg-bg-base)] text-[var(--rg-text-secondary)] hover:bg-[var(--rg-bg-hover)]",
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function DetailGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; wide?: boolean; mono?: boolean }>
}) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={item.wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
          <dt className="rg-caption text-[var(--rg-text-muted)]">{item.label}</dt>
          <dd
            className={cn(
              "rg-label-1 mt-1.5 text-[var(--rg-text-primary)]",
              item.mono && "rg-mono text-[13px] font-normal break-all",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const PAYMENT_STEPS = [
  { key: "prepared", label: "Prepared" },
  { key: "executing", label: "Executing" },
  { key: "submitted", label: "Submitted" },
  { key: "confirmed", label: "Confirmed" },
  { key: "executed", label: "Settled" },
] as const

export function PaymentStepper({ status }: { status: string }) {
  const order = ["prepared", "executing", "submitted", "unknown", "reconciliation_required", "confirmed", "executed"]
  const idx = Math.max(0, order.indexOf(status))
  const activeIdx =
    status === "executed" || status === "confirmed"
      ? PAYMENT_STEPS.length - 1
      : status === "submitted" || status === "unknown" || status === "reconciliation_required"
        ? 2
        : status === "executing"
          ? 1
          : 0

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PAYMENT_STEPS.map((step, stepIdx) => {
        const done = stepIdx < activeIdx
        const active = stepIdx === activeIdx
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div
              className={cn(
                "rg-caption flex h-8 min-w-8 items-center justify-center rounded-full transition",
                done && "bg-[var(--rg-state-joy)] text-white",
                active && "bg-[var(--rg-brand)] text-white ring-4 ring-[var(--rg-accent-glow)]",
                !done && !active && "border border-[var(--rg-border)] bg-[var(--rg-bg-base)] text-[var(--rg-text-muted)]",
              )}
            >
              {stepIdx + 1}
            </div>
            <span
              className={cn(
                "rg-label-2",
                active ? "text-[var(--rg-brand)]" : "text-[var(--rg-text-muted)]",
              )}
            >
              {step.label}
            </span>
            {stepIdx < PAYMENT_STEPS.length - 1 ? (
              <div className={cn("mx-1 h-px w-6", done ? "bg-[var(--rg-state-joy)]" : "bg-[var(--rg-border)]")} />
            ) : null}
          </div>
        )
      })}
      <span className="sr-only">Current status index {idx}</span>
    </div>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  glow,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  glow?: "accent" | "caution" | "none"
}) {
  return (
    <section
      className={cn(
        "rg-card p-5 md:p-6",
        glow === "accent" && "ring-1 ring-[rgba(0,82,255,0.15)]",
        glow === "caution" && "ring-1 ring-[rgba(207,71,14,0.18)]",
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="rg-title-3 text-[var(--rg-text-primary)]">{title}</h2>
          {description ? <p className="rg-body mt-1 text-[var(--rg-text-muted)]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
