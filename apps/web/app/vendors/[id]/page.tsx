"use client"

import { ArrowLeft, CheckCircle2, Circle, Plus } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { AuditTimeline } from "../../../components/ui/AuditTimeline"
import { Badge } from "../../../components/ui/Badge"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { Modal } from "../../../components/ui/Modal"
import { Skeleton } from "../../../components/ui/Skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/Table"
import { api } from "../../../lib/api"
import { getErrorMessage } from "../../../lib/errors"
import { formatDate } from "../../../lib/format"
import { useVendor } from "../../../lib/hooks"

export default function VendorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { vendor, wallets, onboardingChecklist, auditEvents, isLoading, mutate } = useVendor(id)

  const [walletModalOpen, setWalletModalOpen] = React.useState(false)
  const [walletAddress, setWalletAddress] = React.useState("")
  const [walletChain, setWalletChain] = React.useState("base-sepolia")
  const [addingWallet, setAddingWallet] = React.useState(false)
  const [walletError, setWalletError] = React.useState("")

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!vendor) return <div>Vendor not found.</div>

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!walletAddress.trim()) return

    setAddingWallet(true)
    setWalletError("")

    try {
      await api.addVendorWallet(vendor.id, {
        vendorID: vendor.id,
        chain: walletChain,
        address: walletAddress,
      })
      setWalletModalOpen(false)
      setWalletAddress("")
      mutate()
    } catch (error) {
      setWalletError(getErrorMessage(error, "Failed to add wallet"))
    } finally {
      setAddingWallet(false)
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-medium text-[var(--rg-text-muted)] hover:text-[var(--rg-text-primary)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Vendors
      </button>

      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
          {vendor.name}
        </h1>
        <Badge status={vendor.status} variant="dot" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Registered Wallets</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                onClick={() => setWalletModalOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add Wallet
              </Button>
            </CardHeader>
            <div className="mt-4">
              {!wallets || wallets.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--rg-border)] py-6 text-center text-sm text-[var(--rg-text-muted)]">
                  No wallets registered for this vendor.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wallets.map((wallet) => (
                      <TableRow key={wallet.id}>
                        <TableCell className="font-mono text-sm">{wallet.address}</TableCell>
                        <TableCell>
                          <Badge variant="outline" status="info">
                            {wallet.chain}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge status={wallet.status} />
                        </TableCell>
                        <TableCell className="text-[var(--rg-text-muted)]">
                          {formatDate(wallet.firstSeenAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vendor Audit Trail</CardTitle>
            </CardHeader>
            <div className="mt-4 max-h-[400px] overflow-y-auto pr-2">
              <AuditTimeline events={auditEvents || []} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="dark">
            <CardHeader>
              <CardTitle className="text-lg">Risk Profile</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--rg-text-muted)]">Risk Score</span>
                <span
                  className={`font-semibold ${
                    vendor.riskScore > 70
                      ? "text-[var(--rg-status-block)]"
                      : vendor.riskScore > 30
                        ? "text-[var(--rg-status-escalate)]"
                        : "text-[var(--rg-status-allow)]"
                  }`}
                >
                  {vendor.riskScore}/100
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--rg-text-muted)]">Added</span>
                <span className="text-white">{formatDate(vendor.createdAt)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Onboarding Status</CardTitle>
            </CardHeader>
            <ul className="mt-4 space-y-3">
              {onboardingChecklist?.map((item) => {
                const isComplete = item === "Vendor is ready for payments"
                return (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--rg-status-allow)]" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[var(--rg-text-muted)]" />
                    )}
                    <span
                      className={
                        isComplete ? "text-[var(--rg-text-primary)]" : "text-[var(--rg-text-muted)]"
                      }
                    >
                      {item}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        title="Add Vendor Wallet"
      >
        <form onSubmit={handleAddWallet} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="wallet-chain"
              className="text-sm font-medium text-[var(--rg-text-primary)]"
            >
              Chain
            </label>
            <select
              id="wallet-chain"
              className="flex h-12 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rg-brand)]"
              value={walletChain}
              onChange={(e) => setWalletChain(e.target.value)}
            >
              <option value="base-sepolia">Base Sepolia</option>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
            </select>
          </div>
          <Input
            label="Wallet Address"
            placeholder="0x..."
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            required
          />
          {walletError ? (
            <p className="text-sm text-[var(--rg-status-block)]">{walletError}</p>
          ) : null}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setWalletModalOpen(false)}
              disabled={addingWallet}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!walletAddress.trim() || addingWallet}
              isLoading={addingWallet}
            >
              Add Wallet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
