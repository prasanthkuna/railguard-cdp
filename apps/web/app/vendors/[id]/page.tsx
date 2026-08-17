"use client"

import { CheckCircle2, Circle, Plus } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { BackLink, DetailGrid, PageHeader, SectionCard } from "../../../components/design-system"
import { AuditTimeline } from "../../../components/ui/AuditTimeline"
import { Badge } from "../../../components/ui/Badge"
import { Button } from "../../../components/ui/Button"
import { Input, SelectField } from "../../../components/ui/Input"
import { Modal, ModalActions } from "../../../components/ui/Modal"
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
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="rg-glass rounded-[var(--rg-radius-lg)] p-8 text-center">
        <p className="text-[var(--rg-text-muted)]">Vendor not found.</p>
      </div>
    )
  }

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

  const riskTone =
    vendor.riskScore > 70
      ? "text-[var(--rg-state-regret)]"
      : vendor.riskScore > 30
        ? "text-[var(--rg-state-caution)]"
        : "text-[var(--rg-state-joy)]"

  return (
    <div className="space-y-6 pb-16">
      <BackLink label="Back to Vendors" onClick={() => router.back()} />

      <PageHeader
        eyebrow="Counterparty"
        title={vendor.name}
        description={`Added ${formatDate(vendor.createdAt)}`}
        actions={<Badge status={vendor.status} variant="dot" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Registered Wallets"
            action={
              <Button size="sm" variant="secondary" className="gap-2" onClick={() => setWalletModalOpen(true)}>
                <Plus className="h-4 w-4" /> Add Wallet
              </Button>
            }
          >
            {!wallets || wallets.length === 0 ? (
              <div className="rounded-[var(--rg-radius-md)] border border-dashed border-[var(--rg-border)] py-8 text-center text-sm text-[var(--rg-text-muted)]">
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
                      <TableCell className="font-mono text-xs">{wallet.address}</TableCell>
                      <TableCell>
                        <Badge variant="outline" status="info">{wallet.chain}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge status={wallet.status} />
                      </TableCell>
                      <TableCell className="text-[var(--rg-text-muted)]">{formatDate(wallet.firstSeenAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title="Vendor Audit Trail">
            <div className="max-h-[420px] overflow-y-auto pr-1">
              <AuditTimeline events={auditEvents || []} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Risk Profile" glow={vendor.riskScore > 70 ? "caution" : "accent"}>
            <DetailGrid
              items={[
                { label: "Risk Score", value: <span className={riskTone}>{vendor.riskScore}/100</span> },
                { label: "Added", value: formatDate(vendor.createdAt) },
              ]}
            />
          </SectionCard>

          <SectionCard title="Onboarding Status">
            <ul className="space-y-3">
              {onboardingChecklist?.map((item) => {
                const isComplete = item === "Vendor is ready for payments"
                return (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--rg-state-joy)]" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-[var(--rg-text-muted)]" />
                    )}
                    <span className={isComplete ? "text-[var(--rg-text-primary)]" : "text-[var(--rg-text-muted)]"}>
                      {item}
                    </span>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        </div>
      </div>

      <Modal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} title="Add Vendor Wallet">
        <form onSubmit={handleAddWallet} className="space-y-4">
          <SelectField label="Chain" value={walletChain} onChange={(e) => setWalletChain(e.target.value)}>
            <option value="base-sepolia">Base Sepolia</option>
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
          </SelectField>
          <Input label="Wallet Address" placeholder="0x..." value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} required />
          {walletError ? <p className="text-sm text-[var(--rg-state-regret)]">{walletError}</p> : null}
          <ModalActions>
            <Button type="button" variant="ghost" onClick={() => setWalletModalOpen(false)} disabled={addingWallet}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={!walletAddress.trim() || addingWallet} isLoading={addingWallet}>Add Wallet</Button>
          </ModalActions>
        </form>
      </Modal>
    </div>
  )
}
