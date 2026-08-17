"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { FilterTabs, PageHeader } from "../../components/design-system"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { EmptyState } from "../../components/ui/EmptyState"
import { Skeleton } from "../../components/ui/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { formatDate, formatUSDC } from "../../lib/format"
import { useInvoices } from "../../lib/hooks"

const INVOICE_SKELETON_KEYS = ["invoice-1", "invoice-2", "invoice-3", "invoice-4", "invoice-5"]

const TABS = [
  { value: "", label: "All" },
  { value: "received", label: "Received" },
  { value: "ready", label: "Ready" },
  { value: "needs_approval", label: "Needs Approval" },
  { value: "blocked", label: "Blocked" },
  { value: "payment_intent_created", label: "Payment Intent" },
  { value: "executed", label: "Executed" },
]

export default function InvoicesPage() {
  const router = useRouter()
  const [status, setStatus] = React.useState("")
  const { invoices, isLoading } = useInvoices(status)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payables"
        title="Invoice Inbox"
        description="Triage incoming payables, verify risk signals, and clear approvals."
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/vendors")}>
              Vendor Registry
            </Button>
            <Button variant="accent" onClick={() => router.push("/invoices/upload")}>
              Import Invoice
            </Button>
          </>
        }
      />

      <FilterTabs tabs={TABS} value={status} onChange={setStatus} />

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-4 p-6">
            {INVOICE_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No invoices found"
              description="Import invoice documents or create records to start the payable review queue."
              action={<Button variant="accent" onClick={() => router.push("/invoices/upload")}>Import Invoice</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <TableCell className="font-medium text-[var(--rg-text-primary)]">
                    {inv.vendorNameRaw || "Unknown"}
                  </TableCell>
                  <TableCell className="text-[var(--rg-text-muted)]">{inv.invoiceNumber || "N/A"}</TableCell>
                  <TableCell className="font-medium text-[var(--rg-text-primary)]">
                    {formatUSDC(inv.amountBaseUnits)}
                  </TableCell>
                  <TableCell className="text-[var(--rg-text-muted)]">{formatDate(inv.createdAt)}</TableCell>
                  <TableCell>
                    <Badge status={inv.status} variant="dot" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
