"use client"

import { Plus } from "lucide-react"
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
import { formatDate } from "../../lib/format"
import { useVendors } from "../../lib/hooks"

const VENDOR_SKELETON_KEYS = ["vendor-1", "vendor-2", "vendor-3", "vendor-4", "vendor-5"]

export default function VendorsPage() {
  const router = useRouter()
  const { vendors, isLoading } = useVendors()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Vendors
          </h1>
          <p className="text-[var(--rg-text-muted)]">
            Maintain payout counterparties, wallet approvals, and risk posture.
          </p>
        </div>
        <Button className="gap-2" onClick={() => router.push("/vendors/new")}>
          <Plus className="h-4 w-4" />
          Add Counterparty
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {VENDOR_SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-12 w-full" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No vendors found"
              description="Create your approved vendor registry before releasing payments."
              action={<Button onClick={() => router.push("/vendors/new")}>Add Counterparty</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Added Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow
                  key={vendor.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/vendors/${vendor.id}`)}
                >
                  <TableCell className="font-medium text-[var(--rg-text-primary)]">
                    {vendor.name}
                  </TableCell>
                  <TableCell>
                    <Badge status={vendor.status} variant="dot" />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${vendor.riskScore > 70 ? "text-[var(--rg-status-block)]" : vendor.riskScore > 30 ? "text-[var(--rg-status-escalate)]" : "text-[var(--rg-status-allow)]"}`}
                    >
                      {vendor.riskScore}/100
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--rg-text-muted)]">
                    {formatDate(vendor.createdAt)}
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
