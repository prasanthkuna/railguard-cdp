"use client"

import { AlertTriangle, CheckCircle, FileClock, FileText, ShieldAlert, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { HeroMetric, PageHeader, SectionCard, StatCard } from "../components/design-system"
import { Button } from "../components/ui/Button"
import { Skeleton } from "../components/ui/Skeleton"
import { formatUSDC } from "../lib/format"
import { useDashboard, useWorkspace } from "../lib/hooks"

const DASHBOARD_SKELETON_KEYS = ["pending", "approval", "blocked", "ready"] as const

export default function DashboardPage() {
  const router = useRouter()
  const { workspace, error: wsError, isLoading: wsLoading } = useWorkspace()
  const { data, isLoading } = useDashboard()

  React.useEffect(() => {
    if (wsError && (wsError as Error).message.includes("not found")) {
      router.push("/setup")
    }
  }, [wsError, router])

  if (wsLoading || isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-24 w-full max-w-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DASHBOARD_SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-36 rounded-[var(--rg-radius-lg)]" />
          ))}
        </div>
        <Skeleton className="h-56 w-full rounded-[var(--rg-radius-xl)]" />
      </div>
    )
  }

  if (!workspace || !data) return null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payment Control Room"
        title="Control Center"
        description={`Live invoice risk posture and approval health for ${workspace.name}.`}
        actions={
          <>
            <Link href="/invoices/upload">
              <Button variant="accent" className="gap-2">
                <FileText className="h-4 w-4" />
                Import Invoice
              </Button>
            </Link>
            <Link href="/invoices">
              <Button variant="secondary" className="gap-2">
                Review Queue
              </Button>
            </Link>
          </>
        }
      />

      <div className="rg-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending Review"
          value={data.pendingReview}
          hint="Awaiting extraction or triage"
          tone="neutral"
          icon={FileClock}
        />
        <StatCard
          label="Needs Approval"
          value={data.needsApproval}
          hint="Policy escalation required"
          tone="caution"
          icon={AlertTriangle}
        />
        <StatCard
          label="Blocked"
          value={data.blocked}
          hint="Hard policy stops"
          tone="regret"
          icon={ShieldAlert}
        />
        <StatCard
          label="Ready to Pay"
          value={data.readyToPay}
          hint="Cleared for execution"
          tone="joy"
          icon={CheckCircle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <HeroMetric
            label="Total Protected Volume"
            value={formatUSDC(data.totalProtectedBaseUnits)}
            sub="Gross payment volume screened with policy controls before broadcast."
            accent="accent"
          />
        </div>
        <div className="lg:col-span-2">
          <SectionCard
            title="Risk Events"
            description="Policy triggers requiring review or intervention."
            glow={data.riskEventsDetected > 0 ? "caution" : "none"}
          >
            <div className="flex items-end justify-between gap-4">
              <p className="rg-display-3 font-normal text-[var(--rg-state-caution)]">
                {data.riskEventsDetected}
              </p>
              <Sparkles className="h-8 w-8 text-[var(--rg-text-muted)] opacity-40" />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
