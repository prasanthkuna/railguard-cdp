"use client"

import { ArrowLeft, Check, CreditCard, ExternalLink, Play, X } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import { AuditTimeline } from "../../../components/ui/AuditTimeline"
import { Badge } from "../../../components/ui/Badge"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { Modal } from "../../../components/ui/Modal"
import { Skeleton } from "../../../components/ui/Skeleton"
import { api } from "../../../lib/api"
import { getErrorMessage } from "../../../lib/errors"
import { formatAddress, formatConfidence, formatDate, formatUSDC } from "../../../lib/format"
import { useInvoice, useWorkspace } from "../../../lib/hooks"
import type { OrganizationRecord, PolicyRun } from "../../../lib/types"

type PolicySimulationForm = Pick<
  OrganizationRecord,
  | "approvalThresholdBaseUnits"
  | "hardCapBaseUnits"
  | "allowedToken"
  | "allowedChain"
  | "amountReviewMultiplier"
  | "walletRiskThreshold"
>

function simulationDefaults(workspace?: OrganizationRecord): PolicySimulationForm | null {
  if (!workspace) return null

  return {
    approvalThresholdBaseUnits: workspace.approvalThresholdBaseUnits,
    hardCapBaseUnits: workspace.hardCapBaseUnits,
    allowedToken: workspace.allowedToken,
    allowedChain: workspace.allowedChain,
    amountReviewMultiplier: workspace.amountReviewMultiplier,
    walletRiskThreshold: workspace.walletRiskThreshold,
  }
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { invoice, policyRun, paymentIntents, auditEvents, isLoading, mutate } = useInvoice(id)
  const { workspace } = useWorkspace()

  const [approvalModalOpen, setApprovalModalOpen] = React.useState(false)
  const [approvalDecision, setApprovalDecision] = React.useState<"approved" | "rejected">(
    "approved",
  )
  const [approvalReason, setApprovalReason] = React.useState("")

  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false)
  const [paymentLoading, setPaymentLoading] = React.useState(false)
  const [executeLoading, setExecuteLoading] = React.useState(false)
  const [simulationForm, setSimulationForm] = React.useState<PolicySimulationForm | null>(null)
  const [simulationRun, setSimulationRun] = React.useState<PolicyRun | null>(null)
  const [simulationLoading, setSimulationLoading] = React.useState(false)

  React.useEffect(() => {
    if (!workspace || simulationForm) return
    setSimulationForm(simulationDefaults(workspace))
  }, [simulationForm, workspace])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-2/3" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!invoice) return <div>Invoice not found.</div>

  const activeIntent = paymentIntents?.find((intent) => intent.status !== "failed")

  const handleApproval = async () => {
    try {
      await api.decideApproval(invoice.id, approvalDecision, approvalReason)
      setApprovalModalOpen(false)
      mutate()
    } catch (error) {
      alert(getErrorMessage(error, "Failed to update approval"))
    }
  }

  const handleCreatePaymentIntent = async () => {
    try {
      setPaymentLoading(true)
      await api.createPaymentIntent(invoice.id, crypto.randomUUID())
      setPaymentModalOpen(false)
      mutate()
    } catch (error) {
      alert(getErrorMessage(error, "Failed to create payment intent"))
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleExecutePayment = async (intentID: string) => {
    try {
      setExecuteLoading(true)
      await api.executePaymentIntent(intentID, crypto.randomUUID())
      mutate()
    } catch (error) {
      alert(getErrorMessage(error, "Failed to execute payment"))
    } finally {
      setExecuteLoading(false)
    }
  }

  const handleSimulationChange = <K extends keyof PolicySimulationForm>(
    key: K,
    value: PolicySimulationForm[K],
  ) => {
    setSimulationForm((current) => (current ? { ...current, [key]: value } : current))
  }

  const handleSimulatePolicy = async () => {
    if (!simulationForm) return

    try {
      setSimulationLoading(true)
      const { policyRun: simulated } = await api.simulatePolicy(invoice.id, simulationForm)
      setSimulationRun(simulated)
    } catch (error) {
      alert(getErrorMessage(error, "Failed to simulate policy"))
    } finally {
      setSimulationLoading(false)
    }
  }

  const handleResetSimulation = () => {
    setSimulationForm(simulationDefaults(workspace))
    setSimulationRun(null)
  }

  return (
    <div className="space-y-6 pb-20">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm font-medium text-[var(--rg-text-muted)] transition-colors hover:text-[var(--rg-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Invoices
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
              {invoice.vendorNameRaw || "Unknown Vendor"}
            </h1>
            <Badge status={invoice.status} />
          </div>
          <p className="text-xl font-medium text-[var(--rg-text-muted)]">
            {formatUSDC(invoice.amountBaseUnits)} - {invoice.invoiceNumber || "No number"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === "needs_approval" ? (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setApprovalDecision("rejected")
                  setApprovalModalOpen(true)
                }}
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setApprovalDecision("approved")
                  setApprovalModalOpen(true)
                }}
              >
                Approve
              </Button>
            </>
          ) : null}

          {(invoice.status === "ready" || invoice.status === "approved") && !activeIntent ? (
            <Button size="sm" className="gap-2" onClick={() => setPaymentModalOpen(true)}>
              <CreditCard className="h-4 w-4" />
              Create Payment
            </Button>
          ) : null}

          {activeIntent?.status === "prepared" ? (
            <Button
              size="sm"
              className="gap-2 bg-green-600 text-white hover:bg-green-700"
              isLoading={executeLoading}
              onClick={() => handleExecutePayment(activeIntent.id)}
            >
              <Play className="h-4 w-4" />
              Execute Payment
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Extraction Details</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">Extracted Vendor</p>
                <p className="mt-1 font-medium">{invoice.vendorNameRaw || "--"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">Invoice Number</p>
                <p className="mt-1 font-medium">{invoice.invoiceNumber || "--"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">Amount</p>
                <p className="mt-1 font-medium">{formatUSDC(invoice.amountBaseUnits)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">Date</p>
                <p className="mt-1 font-medium">{formatDate(invoice.invoiceDate)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">Wallet Address</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="break-all font-mono text-sm">{invoice.walletAddress || "--"}</p>
                  {invoice.walletAddress ? (
                    <Badge variant="outline" status="info" className="ml-2 font-mono text-[10px]">
                      {invoice.chain}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--rg-text-muted)]">AI Confidence</p>
                <p className="mt-1 font-medium">{formatConfidence(invoice.extractionConfidence)}</p>
              </div>
            </div>
          </Card>

          {policyRun ? (
            <Card variant={policyRun.result === "allow" ? "default" : "dark"}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Policy Evaluation</CardTitle>
                  <Badge status={policyRun.result} />
                </div>
              </CardHeader>
              {policyRun.triggeredRules?.length ? (
                <ul className="mt-4 space-y-2">
                  {policyRun.triggeredRules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-sm">
                      <X
                        className={`mt-0.5 h-4 w-4 ${
                          policyRun.result === "allow"
                            ? "text-[var(--rg-status-block)]"
                            : "text-red-400"
                        }`}
                      />
                      <span className={policyRun.result === "allow" ? "" : "text-gray-300"}>
                        {rule}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  All policies passed. No anomalies detected.
                </div>
              )}
            </Card>
          ) : null}

          {simulationForm ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">Policy Simulator</CardTitle>
                    <p className="text-sm text-[var(--rg-text-muted)]">
                      Model threshold and chain changes before you update the live workspace.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={handleResetSimulation}>
                      Reset
                    </Button>
                    <Button size="sm" onClick={handleSimulatePolicy} isLoading={simulationLoading}>
                      Run Simulation
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">
                    Approval Threshold (base units)
                  </span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    value={simulationForm.approvalThresholdBaseUnits}
                    onChange={(event) =>
                      handleSimulationChange("approvalThresholdBaseUnits", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">
                    Hard Cap (base units)
                  </span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    value={simulationForm.hardCapBaseUnits}
                    onChange={(event) =>
                      handleSimulationChange("hardCapBaseUnits", event.target.value)
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">Allowed Token</span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    value={simulationForm.allowedToken}
                    onChange={(event) => handleSimulationChange("allowedToken", event.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">Allowed Chain</span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    value={simulationForm.allowedChain}
                    onChange={(event) => handleSimulationChange("allowedChain", event.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">
                    Amount Review Multiplier
                  </span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    type="number"
                    min="1"
                    step="0.1"
                    value={simulationForm.amountReviewMultiplier}
                    onChange={(event) =>
                      handleSimulationChange(
                        "amountReviewMultiplier",
                        Number(event.target.value || workspace?.amountReviewMultiplier || 3),
                      )
                    }
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-[var(--rg-text-primary)]">
                    Wallet Risk Threshold
                  </span>
                  <input
                    className="flex h-10 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={simulationForm.walletRiskThreshold}
                    onChange={(event) =>
                      handleSimulationChange(
                        "walletRiskThreshold",
                        Number(event.target.value || workspace?.walletRiskThreshold || 80),
                      )
                    }
                  />
                </label>
              </div>

              {simulationRun ? (
                <div className="mt-6 rounded-2xl border border-[var(--rg-border)] bg-[var(--rg-bg-soft)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--rg-text-primary)]">
                        Simulation Result
                      </p>
                      <p className="text-sm text-[var(--rg-text-muted)]">
                        This preview does not change the stored invoice status.
                      </p>
                    </div>
                    <Badge status={simulationRun.result} />
                  </div>
                  {simulationRun.triggeredRules.length ? (
                    <ul className="space-y-2 text-sm">
                      {simulationRun.triggeredRules.map((rule) => (
                        <li key={rule} className="flex items-start gap-2">
                          <X className="mt-0.5 h-4 w-4 text-[var(--rg-status-block)]" />
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Simulation passed with no triggered rules.
                    </div>
                  )}
                </div>
              ) : null}
            </Card>
          ) : null}

          {activeIntent ? (
            <Card className="border-[var(--rg-brand)] bg-blue-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Payment Intent</CardTitle>
                  <Badge status={activeIntent.status} />
                </div>
              </CardHeader>
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-[var(--rg-text-muted)]">Recipient</span>
                  <span className="font-mono">{formatAddress(activeIntent.recipientAddress)}</span>
                </div>
                <div>
                  <span className="block text-[var(--rg-text-muted)]">Amount</span>
                  <span className="font-medium">{formatUSDC(activeIntent.amountBaseUnits)}</span>
                </div>
                {activeIntent.txHash ? (
                  <div className="col-span-2 mt-2 border-t border-blue-100 pt-4">
                    <span className="block text-[var(--rg-text-muted)]">Transaction Hash</span>
                    <a
                      href={`https://sepolia.basescan.org/tx/${activeIntent.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 font-mono text-[var(--rg-brand)] hover:underline"
                    >
                      {activeIntent.txHash} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Trail</CardTitle>
            </CardHeader>
            <div className="mt-4 max-h-[500px] overflow-y-auto pr-2">
              <AuditTimeline events={auditEvents || []} />
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        title={`Confirm ${approvalDecision}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--rg-text-muted)]">
            You are about to {approvalDecision === "approved" ? "approve" : "reject"} invoice{" "}
            {invoice.invoiceNumber}.
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor="approval-reason"
              className="text-sm font-medium text-[var(--rg-text-primary)]"
            >
              Reason (optional)
            </label>
            <textarea
              id="approval-reason"
              className="flex w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--rg-text-muted)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rg-brand)]"
              rows={3}
              value={approvalReason}
              onChange={(e) => setApprovalReason(e.target.value)}
              placeholder="Add a note for the audit trail..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setApprovalModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={approvalDecision === "approved" ? "primary" : "danger"}
              onClick={handleApproval}
            >
              Confirm {approvalDecision}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Create Payment Intent"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--rg-text-muted)]">
            This will prepare a USDC transaction on {invoice.chain} for{" "}
            <strong>{formatUSDC(invoice.amountBaseUnits)}</strong> to{" "}
            <strong>{formatAddress(invoice.walletAddress)}</strong> via Coinbase Developer Platform.
          </p>
          <p className="text-sm text-[var(--rg-text-muted)]">
            Funds will not be transferred until the execution step.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setPaymentModalOpen(false)}
              disabled={paymentLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePaymentIntent} isLoading={paymentLoading}>
              Create Intent
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
