"use client"

import { Download } from "lucide-react"
import * as React from "react"
import { AuditTimeline } from "../../components/ui/AuditTimeline"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { api } from "../../lib/api"
import { getErrorMessage } from "../../lib/errors"
import { useWorkspace } from "../../lib/hooks"
import type { AuditEvent } from "../../lib/types"

export default function AuditPage() {
  const { workspace } = useWorkspace()
  const [entityType, setEntityType] = React.useState("organization")
  const [entityID, setEntityID] = React.useState("")

  const [events, setEvents] = React.useState<AuditEvent[]>([])
  const [loading, setLoading] = React.useState(false)
  const [searched, setSearched] = React.useState(false)

  const [exporting, setExporting] = React.useState(false)
  const [exportMessage, setExportMessage] = React.useState("")

  // Set default entityID to workspace ID when available
  React.useEffect(() => {
    if (workspace && !entityID && entityType === "organization") {
      setEntityID(workspace.id)
    }
  }, [workspace, entityID, entityType])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!entityID.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const res = await api.getAuditTrail(entityType, entityID)
      setEvents(res.auditEvents || [])
    } catch (error) {
      alert(getErrorMessage(error, "Failed to fetch audit trail"))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!entityID.trim()) return

    setExporting(true)
    setExportMessage("")
    try {
      const { auditExport } = await api.createAuditExport(entityType, entityID, "csv")
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const result = await api.getAuditExport(auditExport.id)
        if (result.downloadURL) {
          window.open(result.downloadURL, "_blank", "noopener,noreferrer")
          setExportMessage("CSV export is ready.")
          setExporting(false)
          return
        }
        if (result.auditExport.status === "failed") {
          throw new Error(result.auditExport.errorMessage || "Audit export failed")
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
      setExportMessage("Export queued. Check again in a moment.")
    } catch (error) {
      alert(getErrorMessage(error, "Failed to export audit trail"))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Audit Trail
          </h1>
          <p className="text-[var(--rg-text-muted)]">
            Immutable append-only ledger of all workspace activity.
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label
              htmlFor="audit-entity-type"
              className="text-sm font-medium text-[var(--rg-text-primary)]"
            >
              Entity Type
            </label>
            <select
              id="audit-entity-type"
              className="flex h-12 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rg-brand)]"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="organization">Workspace / Organization</option>
              <option value="invoice">Invoice</option>
              <option value="vendor">Vendor</option>
              <option value="payment_intent">Payment Intent</option>
            </select>
          </div>

          <div className="flex-[2]">
            <Input
              label="Entity ID"
              placeholder="e.g. org_123 or inv_456"
              value={entityID}
              onChange={(e) => setEntityID(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            isLoading={loading}
            disabled={!entityID.trim() || loading}
            className="w-full sm:w-auto"
          >
            Search Ledger
          </Button>
        </form>
      </Card>

      {searched && (
        <Card className="min-h-[400px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Event History</CardTitle>
            {events.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                isLoading={exporting}
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </CardHeader>
          <div className="mt-4">
            {exportMessage ? (
              <p className="mb-4 text-sm text-[var(--rg-text-muted)]">{exportMessage}</p>
            ) : null}
            {loading ? (
              <p className="text-sm text-[var(--rg-text-muted)]">Querying ledger...</p>
            ) : (
              <AuditTimeline events={events} />
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
