"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Invoice Inbox
          </h1>
          <p className="text-[var(--rg-text-muted)]">Manage and verify incoming invoices.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.value}
            variant={status === tab.value ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStatus(tab.value)}
            className="rounded-full px-4 h-10"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {INVOICE_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No invoices found"
              description="Upload your first invoice to begin verification."
              action={
                <Button onClick={() => router.push("/invoices/upload")}>Upload Invoice</Button>
              }
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
                  <TableCell className="text-[var(--rg-text-muted)]">
                    {inv.invoiceNumber || "N/A"}
                  </TableCell>
                  <TableCell className="font-medium">{formatUSDC(inv.amountBaseUnits)}</TableCell>
                  <TableCell className="text-[var(--rg-text-muted)]">
                    {formatDate(inv.createdAt)}
                  </TableCell>
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
