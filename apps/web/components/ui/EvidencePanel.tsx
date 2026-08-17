"use client"

import * as React from "react"
import { SectionCard } from "../design-system"
import { Skeleton } from "./Skeleton"
import { cn } from "../../lib/cn"
import type { V5EvidenceExplain, V5EvidenceResponse } from "../../lib/types"

function Row({ label, value, valid }: { label: string; value: string; valid?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--rg-border)] py-2 last:border-0">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--rg-text-muted)]">{label}</span>
      <span
        className={cn(
          "text-right text-sm font-medium text-[var(--rg-text-primary)]",
          valid === true && "text-[var(--rg-success)]",
          valid === false && "text-[var(--rg-danger)]",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function EvidencePanel({
  evidence,
  isLoading,
  error,
}: {
  evidence?: V5EvidenceResponse | null
  isLoading?: boolean
  error?: string | null
}) {
  if (isLoading) {
    return (
      <SectionCard title="Why was this payment allowed?">
        <Skeleton className="h-48 w-full" />
      </SectionCard>
    )
  }

  if (error) {
    return (
      <SectionCard title="Why was this payment allowed?">
        <p className="text-sm text-[var(--rg-text-muted)]">{error}</p>
      </SectionCard>
    )
  }

  if (!evidence) return null

  const explain: V5EvidenceExplain = evidence.explain

  return (
    <SectionCard title="Why was this payment allowed?">
      <div className="rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-alternate)] p-4">
        <Row label="Agent" value={explain.agent} />
        {explain.task ? <Row label="Task" value={explain.task} /> : null}
        <Row label="Requested" value={explain.requested} />
        {explain.budget ? <Row label="Budget" value={explain.budget} /> : null}
        {explain.merchant ? <Row label="Merchant" value={explain.merchant} /> : null}
        <Row label="Policy" value={explain.policyVersion} />
        <Row label="Decision" value={explain.decision.toUpperCase()} />
        {explain.rail ? <Row label="Rail" value={explain.rail} /> : null}
        <Row label="Settlement" value={explain.settlement} />
        <Row label="Evidence" value={explain.evidenceValid ? "VALID" : "INVALID"} valid={explain.evidenceValid} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--rg-brand)] hover:underline">
          View evidence envelope
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto rounded-[var(--rg-radius-md)] border border-[var(--rg-border)] bg-[var(--rg-bg-base)] p-3 text-[11px] text-[var(--rg-text-secondary)]">
          {JSON.stringify(evidence.evidence, null, 2)}
        </pre>
      </details>
    </SectionCard>
  )
}

export function EvidencePanelByPaymentIntent({ paymentIntentId }: { paymentIntentId: string }) {
  const [state, setState] = React.useState<{
    data?: V5EvidenceResponse
    loading: boolean
    error?: string
  }>({ loading: true })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { api } = await import("../../lib/api")
        const data = await api.getPaymentIntentEvidence(paymentIntentId)
        if (!cancelled) setState({ data, loading: false })
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err.message : "Evidence not available yet",
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paymentIntentId])

  return (
    <EvidencePanel evidence={state.data} isLoading={state.loading} error={state.error ?? null} />
  )
}
