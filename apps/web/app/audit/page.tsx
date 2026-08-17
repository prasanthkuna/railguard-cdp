"use client"

import { Download } from "lucide-react"
import * as React from "react"
import { PageHeader, SectionCard } from "../../components/design-system"
import { AuditTimeline } from "../../components/ui/AuditTimeline"
import { Button } from "../../components/ui/Button"
import { Input, SelectField } from "../../components/ui/Input"
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
      <PageHeader
        eyebrow="Compliance"
        title="Audit Trail"
        description="Immutable ledger of policy decisions, approvals, and payment actions."
      />

      <SectionCard title="Query Ledger" description="Search append-only events by entity type and ID.">
        <form onSubmit={handleSearch} className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <SelectField
              label="Entity Type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option value="organization">Workspace / Organization</option>
              <option value="invoice">Invoice</option>
              <option value="vendor">Vendor</option>
              <option value="payment_intent">Payment Intent</option>
            </SelectField>
          </div>
          <div className="flex-[2]">
            <Input
              label="Entity ID"
              placeholder="organization_id, invoice_id, vendor_id, or payment_intent_id"
              value={entityID}
              onChange={(e) => setEntityID(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="accent" isLoading={loading} disabled={!entityID.trim() || loading} className="w-full lg:w-auto">
            Search Ledger
          </Button>
        </form>
      </SectionCard>

      {searched ? (
        <SectionCard
          title="Event History"
          action={
            events.length > 0 ? (
              <Button size="sm" variant="secondary" className="gap-2" isLoading={exporting} onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export Evidence
              </Button>
            ) : undefined
          }
        >
          {exportMessage ? <p className="mb-4 text-sm text-[var(--rg-text-muted)]">{exportMessage}</p> : null}
          {loading ? (
            <p className="text-sm text-[var(--rg-text-muted)]">Querying ledger...</p>
          ) : (
            <AuditTimeline events={events} />
          )}
        </SectionCard>
      ) : null}
    </div>
  )
}
