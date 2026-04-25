"use client"

import { AlertTriangle, CheckCircle, FileClock, FileText, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../components/ui/Card"
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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!workspace || !data) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Dashboard
          </h1>
          <p className="text-[var(--rg-text-muted)]">
            Overview of {workspace.name}'s payment security.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="secondary" className="gap-2">
              <FileText className="h-4 w-4" />
              View All Invoices
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="stat" className="relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-[var(--rg-surface-secondary)]" />
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full bg-[var(--rg-surface-secondary)] p-2">
              <FileClock className="h-5 w-5 text-[var(--rg-text-muted)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--rg-text-muted)]">Pending Review</h3>
          </div>
          <p className="text-3xl font-semibold text-[var(--rg-text-primary)]">
            {data.pendingReview}
          </p>
        </Card>

        <Card variant="stat" className="relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-orange-50" />
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full bg-orange-100 p-2">
              <AlertTriangle className="h-5 w-5 text-[var(--rg-status-escalate)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--rg-text-muted)]">Needs Approval</h3>
          </div>
          <p className="text-3xl font-semibold text-[var(--rg-text-primary)]">
            {data.needsApproval}
          </p>
        </Card>

        <Card variant="stat" className="relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-red-50" />
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full bg-red-100 p-2">
              <ShieldAlert className="h-5 w-5 text-[var(--rg-status-block)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--rg-text-muted)]">Blocked</h3>
          </div>
          <p className="text-3xl font-semibold text-[var(--rg-text-primary)]">{data.blocked}</p>
        </Card>

        <Card variant="stat" className="relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 h-16 w-16 rounded-full bg-blue-50" />
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-full bg-blue-100 p-2">
              <CheckCircle className="h-5 w-5 text-[var(--rg-status-info)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--rg-text-muted)]">Ready to Pay</h3>
          </div>
          <p className="text-3xl font-semibold text-[var(--rg-text-primary)]">{data.readyToPay}</p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card variant="dark">
          <CardHeader>
            <CardTitle className="text-lg">Total Protected</CardTitle>
          </CardHeader>
          <div className="flex h-32 flex-col justify-end">
            <p className="text-5xl font-display font-light text-white">
              {formatUSDC(data.totalProtectedBaseUnits)}
            </p>
            <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
              Total volume secured by Railguard this month
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Events</CardTitle>
          </CardHeader>
          <div className="flex h-32 flex-col justify-end">
            <p className="text-5xl font-display font-light text-[var(--rg-status-block)]">
              {data.riskEventsDetected}
            </p>
            <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
              Policy violations and anomalies blocked
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
