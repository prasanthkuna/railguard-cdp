"use client"

import { Check, CreditCard, ExternalLink, Play, X } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import * as React from "react"
import {
  BackLink,
  DetailGrid,
  PageHeader,
  PaymentStepper,
  SectionCard,
} from "../../../components/design-system"
import { AuditTimeline } from "../../../components/ui/AuditTimeline"
import { EvidencePanelByPaymentIntent } from "../../../components/ui/EvidencePanel"
import { Badge } from "../../../components/ui/Badge"
import { Button } from "../../../components/ui/Button"
import { Input, TextAreaField } from "../../../components/ui/Input"
import { Modal, ModalActions } from "../../../components/ui/Modal"
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
  const [approvalDecision, setApprovalDecision] = React.useState<"approved" | "rejected">("approved")
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
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="col-span-2 h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="rg-glass rounded-[var(--rg-radius-lg)] p-8 text-center">
        <p className="text-[var(--rg-text-muted)]">Invoice not found.</p>
      </div>
    )
  }

  const activeIntent = paymentIntents?.find((intent) => intent.status !== "failed")
  const paymentStatus = activeIntent?.status || invoice.status

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

  return (
    <div className="space-y-6 pb-16">
      <BackLink label="Back to Invoices" onClick={() => router.back()} />

      <PageHeader
        eyebrow={invoice.invoiceNumber || "Invoice"}
        title={invoice.vendorNameRaw || "Unknown Vendor"}
        description={`${formatUSDC(invoice.amountBaseUnits)} · ${formatDate(invoice.invoiceDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={invoice.status} />
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
                  variant="accent"
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
              <Button size="sm" variant="accent" className="gap-2" onClick={() => setPaymentModalOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Create Payment
              </Button>
            ) : null}
            {activeIntent?.status === "prepared" ? (
              <Button
                size="sm"
                variant="accent"
                className="gap-2"
                isLoading={executeLoading}
                onClick={() => handleExecutePayment(activeIntent.id)}
              >
                <Play className="h-4 w-4" />
                Execute Payment
              </Button>
            ) : null}
          </div>
        }
      />

      {activeIntent ? (
        <SectionCard title="Payment Lifecycle" description="Track execution from prepare to settlement." glow="accent">
          <PaymentStepper status={paymentStatus} />
        </SectionCard>
      ) : null}

      {activeIntent && ["executed", "confirmed", "submitted", "unknown", "reconciliation_required"].includes(activeIntent.status) ? (
        <EvidencePanelByPaymentIntent paymentIntentId={activeIntent.id} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Extraction Details" description="AI-parsed invoice fields and confidence.">
            <DetailGrid
              items={[
                { label: "Extracted Vendor", value: invoice.vendorNameRaw || "—" },
                { label: "Invoice Number", value: invoice.invoiceNumber || "—" },
                { label: "Amount", value: formatUSDC(invoice.amountBaseUnits) },
                { label: "Date", value: formatDate(invoice.invoiceDate) },
                { label: "AI Confidence", value: formatConfidence(invoice.extractionConfidence) },
                {
                  label: "Wallet Address",
                  value: (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{invoice.walletAddress || "—"}</span>
                      {invoice.walletAddress ? <Badge variant="outline" status="info">{invoice.chain}</Badge> : null}
                    </span>
                  ),
                  wide: true,
                  mono: Boolean(invoice.walletAddress),
                },
              ]}
            />
          </SectionCard>

          {policyRun ? (
            <SectionCard
              title="Policy Evaluation"
              glow={policyRun.result === "allow" ? "accent" : "caution"}
              action={<Badge status={policyRun.result} />}
            >
              {policyRun.triggeredRules?.length ? (
                <ul className="space-y-2">
                  {policyRun.triggeredRules.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-sm text-[var(--rg-text-secondary)]">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rg-state-regret)]" />
                      {rule}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--rg-state-joy)]">
                  <Check className="h-4 w-4" />
                  All policies passed. No anomalies detected.
                </div>
              )}
            </SectionCard>
          ) : null}

          {simulationForm ? (
            <SectionCard
              title="Policy Simulator"
              description="Model threshold and chain changes before updating live workspace policy."
              action={
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setSimulationForm(simulationDefaults(workspace)); setSimulationRun(null) }}>
                    Reset
                  </Button>
                  <Button size="sm" variant="accent" onClick={handleSimulatePolicy} isLoading={simulationLoading}>
                    Run Simulation
                  </Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Input label="Approval Threshold (base units)" value={simulationForm.approvalThresholdBaseUnits} onChange={(e) => handleSimulationChange("approvalThresholdBaseUnits", e.target.value)} />
                <Input label="Hard Cap (base units)" value={simulationForm.hardCapBaseUnits} onChange={(e) => handleSimulationChange("hardCapBaseUnits", e.target.value)} />
                <Input label="Allowed Token" value={simulationForm.allowedToken} onChange={(e) => handleSimulationChange("allowedToken", e.target.value)} />
                <Input label="Allowed Chain" value={simulationForm.allowedChain} onChange={(e) => handleSimulationChange("allowedChain", e.target.value)} />
                <Input label="Amount Review Multiplier" type="number" min="1" step="0.1" value={simulationForm.amountReviewMultiplier} onChange={(e) => handleSimulationChange("amountReviewMultiplier", Number(e.target.value || workspace?.amountReviewMultiplier || 3))} />
                <Input label="Wallet Risk Threshold" type="number" min="0" max="100" value={simulationForm.walletRiskThreshold} onChange={(e) => handleSimulationChange("walletRiskThreshold", Number(e.target.value || workspace?.walletRiskThreshold || 80))} />
              </div>
              {simulationRun ? (
                <div className="mt-6 rounded-[var(--rg-radius-lg)] border border-[var(--rg-border)] bg-[var(--rg-bg-panel)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--rg-text-primary)]">Simulation Result</p>
                    <Badge status={simulationRun.result} />
                  </div>
                  {simulationRun.triggeredRules.length ? (
                    <ul className="space-y-2 text-sm">
                      {simulationRun.triggeredRules.map((rule) => (
                        <li key={rule} className="flex items-start gap-2">
                          <X className="mt-0.5 h-4 w-4 text-[var(--rg-state-regret)]" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--rg-state-joy)]">
                      <Check className="h-4 w-4" />
                      Simulation passed with no triggered rules.
                    </div>
                  )}
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {activeIntent ? (
            <SectionCard title="Payment Intent" glow="accent" action={<Badge status={activeIntent.status} />}>
              <DetailGrid
                items={[
                  { label: "Recipient", value: formatAddress(activeIntent.recipientAddress), mono: true },
                  { label: "Amount", value: formatUSDC(activeIntent.amountBaseUnits) },
                  ...(activeIntent.txHash
                    ? [{
                        label: "Transaction Hash",
                        value: (
                          <a
                            href={`https://sepolia.basescan.org/tx/${activeIntent.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--rg-accent)] hover:underline"
                          >
                            {activeIntent.txHash}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ),
                        wide: true,
                        mono: true,
                      }]
                    : []),
                ]}
              />
            </SectionCard>
          ) : null}
        </div>

        <SectionCard title="Audit Trail" description="Append-only record of decisions and execution.">
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <AuditTimeline events={auditEvents || []} />
          </div>
        </SectionCard>
      </div>

      <Modal isOpen={approvalModalOpen} onClose={() => setApprovalModalOpen(false)} title={`Confirm ${approvalDecision}`}>
        <p className="text-sm text-[var(--rg-text-muted)]">
          You are about to {approvalDecision === "approved" ? "approve" : "reject"} invoice {invoice.invoiceNumber}.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="Reason (optional)"
            rows={3}
            value={approvalReason}
            onChange={(e) => setApprovalReason(e.target.value)}
            placeholder="Add a note for the audit trail..."
          />
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setApprovalModalOpen(false)}>Cancel</Button>
          <Button variant={approvalDecision === "approved" ? "accent" : "danger"} onClick={handleApproval}>
            Confirm {approvalDecision}
          </Button>
        </ModalActions>
      </Modal>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="Create Payment Intent">
        <p className="text-sm text-[var(--rg-text-muted)]">
          Prepare a USDC transaction on {invoice.chain} for <strong className="text-[var(--rg-text-primary)]">{formatUSDC(invoice.amountBaseUnits)}</strong> to{" "}
          <strong className="font-mono text-[var(--rg-text-primary)]">{formatAddress(invoice.walletAddress)}</strong> via Coinbase Developer Platform.
        </p>
        <p className="mt-3 text-sm text-[var(--rg-text-muted)]">Funds will not transfer until execution.</p>
        <ModalActions>
          <Button variant="ghost" onClick={() => setPaymentModalOpen(false)} disabled={paymentLoading}>Cancel</Button>
          <Button variant="accent" onClick={handleCreatePaymentIntent} isLoading={paymentLoading}>Create Intent</Button>
        </ModalActions>
      </Modal>
    </div>
  )
}
