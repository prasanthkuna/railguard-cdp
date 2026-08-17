"use client"

import * as React from "react"
import { PageHeader, SectionCard } from "../../components/design-system"
import { Button } from "../../components/ui/Button"
import { Input, SelectField } from "../../components/ui/Input"
import { api } from "../../lib/api"
import { type DevIdentity, getDevIdentity, isDevAuthEnabled, setDevIdentity } from "../../lib/auth"
import { getErrorMessage } from "../../lib/errors"
import { useWorkspace } from "../../lib/hooks"

export default function SettingsPage() {
  const { workspace, mutate } = useWorkspace()
  const devAuthEnabled = isDevAuthEnabled()
  const [loading, setLoading] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState("")
  const [identity, setIdentity] = React.useState<DevIdentity>({
    organizationID: "",
    userID: "",
    role: "owner",
    email: "",
    token: "",
  })
  const [settings, setSettings] = React.useState({
    approvalThresholdBaseUnits: "",
    hardCapBaseUnits: "",
    allowedToken: "",
    allowedChain: "",
    amountReviewMultiplier: 0,
    walletRiskThreshold: 0,
  })

  React.useEffect(() => {
    setIdentity(getDevIdentity())
  }, [])

  React.useEffect(() => {
    if (workspace) {
      setSettings({
        approvalThresholdBaseUnits: workspace.approvalThresholdBaseUnits || "",
        hardCapBaseUnits: workspace.hardCapBaseUnits || "",
        allowedToken: workspace.allowedToken || "USDC",
        allowedChain: workspace.allowedChain || "base-sepolia",
        amountReviewMultiplier: workspace.amountReviewMultiplier || 1.5,
        walletRiskThreshold: workspace.walletRiskThreshold || 30,
      })
    }
  }, [workspace])

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault()
    setDevIdentity(identity)
    window.location.reload()
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMsg("")

    try {
      await api.updateWorkspace({
        ...settings,
        amountReviewMultiplier: Number(settings.amountReviewMultiplier),
        walletRiskThreshold: Number(settings.walletRiskThreshold),
      })
      mutate()
      setSuccessMsg("Settings saved successfully.")
      setTimeout(() => setSuccessMsg(""), 3000)
    } catch (error) {
      alert(getErrorMessage(error, "Failed to save settings"))
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) return null

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description={`Manage policy thresholds${devAuthEnabled ? " and development identity." : "."}`}
      />

      <div className={devAuthEnabled ? "grid gap-6 lg:grid-cols-2" : "space-y-6"}>
        <SectionCard title="Policy Thresholds" description="Configure automatic approval and risk evaluation rules.">
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <Input label="Approval Threshold (Base Units)" value={settings.approvalThresholdBaseUnits} onChange={(e) => setSettings({ ...settings, approvalThresholdBaseUnits: e.target.value })} />
            <Input label="Hard Cap Limit (Base Units)" value={settings.hardCapBaseUnits} onChange={(e) => setSettings({ ...settings, hardCapBaseUnits: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Allowed Token" value={settings.allowedToken} onChange={(e) => setSettings({ ...settings, allowedToken: e.target.value })} />
              <Input label="Allowed Chain" value={settings.allowedChain} onChange={(e) => setSettings({ ...settings, allowedChain: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Amount Review Multiplier" type="number" step="0.1" value={settings.amountReviewMultiplier} onChange={(e) => setSettings({ ...settings, amountReviewMultiplier: Number(e.target.value) })} />
              <Input label="Wallet Risk Threshold (0-100)" type="number" value={settings.walletRiskThreshold} onChange={(e) => setSettings({ ...settings, walletRiskThreshold: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-[var(--rg-state-joy)]">{successMsg}</span>
              <Button type="submit" variant="accent" isLoading={loading} disabled={loading}>Save Settings</Button>
            </div>
          </form>
        </SectionCard>

        {devAuthEnabled ? (
          <SectionCard title="Dev Mode Identity" description="Simulate different users and roles while dev header auth is enabled." glow="accent">
            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Organization ID" value={identity.organizationID} onChange={(e) => setIdentity({ ...identity, organizationID: e.target.value })} />
                <Input label="User ID" value={identity.userID} onChange={(e) => setIdentity({ ...identity, userID: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Email" type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} />
                <SelectField label="Role" value={identity.role} onChange={(e) => setIdentity({ ...identity, role: e.target.value as DevIdentity["role"] })}>
                  <option value="owner">Owner</option>
                  <option value="finance">Finance</option>
                  <option value="approver">Approver</option>
                  <option value="viewer">Viewer</option>
                </SelectField>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="secondary">Apply Identity</Button>
              </div>
            </form>
          </SectionCard>
        ) : null}
      </div>
    </div>
  )
}
