"use client"

import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { BackLink, PageHeader } from "../../components/design-system"
import { EvidencePanel } from "../../components/ui/EvidencePanel"
import { Skeleton } from "../../components/ui/Skeleton"
import { api } from "../../lib/api"
import { getErrorMessage } from "../../lib/errors"
import type { V5EvidenceResponse, V5ExecutionResponse } from "../../lib/types"

export default function ExecutionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const executionId = params?.id as string
  const [execution, setExecution] = React.useState<V5ExecutionResponse | null>(null)
  const [evidence, setEvidence] = React.useState<V5EvidenceResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [exec, ev] = await Promise.all([
          api.getExecution(executionId),
          api.getExecutionEvidence(executionId),
        ])
        if (!cancelled) {
          setExecution(exec)
          setEvidence(ev)
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, "Failed to load execution"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [executionId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !execution) {
    return (
      <div className="space-y-4">
        <BackLink label="Back" onClick={() => router.back()} />
        <p className="text-[var(--rg-text-muted)]">{error ?? "Execution not found"}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <BackLink label="Back" onClick={() => router.back()} />
      <PageHeader
        eyebrow="Execution"
        title={execution.executionId}
        description={`Intent ${execution.intentId} · ${execution.status}`}
      />
      <EvidencePanel evidence={evidence} />
    </div>
  )
}
