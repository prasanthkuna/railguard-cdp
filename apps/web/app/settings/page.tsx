"use client"

import * as React from "react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { api } from "../../lib/api"
import { type DevIdentity, getDevIdentity, isDevAuthEnabled, setDevIdentity } from "../../lib/auth"
import { getErrorMessage } from "../../lib/errors"
import { useWorkspace } from "../../lib/hooks"

export default function SettingsPage() {
  const { workspace, mutate } = useWorkspace()
  const devAuthEnabled = isDevAuthEnabled()
  const [loading, setLoading] = React.useState(false)
  const [successMsg, setSuccessMsg] = React.useState("")

  // Dev Identity State
  const [identity, setIdentity] = React.useState<DevIdentity>({
    organizationID: "",
    userID: "",
    role: "owner",
    email: "",
    token: "",
  })

  // Workspace Settings State
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
    window.location.reload() // Reload to apply new headers everywhere
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
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
          Settings
        </h1>
        <p className="text-[var(--rg-text-muted)]">
          Manage workspace policies{devAuthEnabled ? " and development identity." : "."}
        </p>
      </div>

      <div className={devAuthEnabled ? "grid gap-6 lg:grid-cols-2" : "space-y-6"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Policy Thresholds</CardTitle>
            <p className="text-sm text-[var(--rg-text-muted)]">
              Configure automatic approval and risk evaluation rules.
            </p>
          </CardHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <Input
              label="Approval Threshold (Base Units)"
              value={settings.approvalThresholdBaseUnits}
              onChange={(e) =>
                setSettings({ ...settings, approvalThresholdBaseUnits: e.target.value })
              }
            />
            <Input
              label="Hard Cap Limit (Base Units)"
              value={settings.hardCapBaseUnits}
              onChange={(e) => setSettings({ ...settings, hardCapBaseUnits: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Allowed Token"
                value={settings.allowedToken}
                onChange={(e) => setSettings({ ...settings, allowedToken: e.target.value })}
              />
              <Input
                label="Allowed Chain"
                value={settings.allowedChain}
                onChange={(e) => setSettings({ ...settings, allowedChain: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Amount Review Multiplier"
                type="number"
                step="0.1"
                value={settings.amountReviewMultiplier}
                onChange={(e) =>
                  setSettings({ ...settings, amountReviewMultiplier: Number(e.target.value) })
                }
              />
              <Input
                label="Wallet Risk Threshold (0-100)"
                type="number"
                value={settings.walletRiskThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, walletRiskThreshold: Number(e.target.value) })
                }
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm font-medium text-green-600">{successMsg}</span>
              <Button type="submit" isLoading={loading} disabled={loading}>
                Save Settings
              </Button>
            </div>
          </form>
        </Card>

        {devAuthEnabled ? (
          <Card variant="dark">
            <CardHeader>
              <CardTitle className="text-lg">Dev Mode Identity</CardTitle>
              <p className="text-sm text-[var(--rg-text-muted)]">
                Simulate different users and roles while dev header auth is enabled.
              </p>
            </CardHeader>
            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Organization ID"
                  value={identity.organizationID}
                  onChange={(e) => setIdentity({ ...identity, organizationID: e.target.value })}
                  className="bg-transparent text-white border-gray-600 focus-visible:ring-gray-400"
                />
                <Input
                  label="User ID"
                  value={identity.userID}
                  onChange={(e) => setIdentity({ ...identity, userID: e.target.value })}
                  className="bg-transparent text-white border-gray-600 focus-visible:ring-gray-400"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Email"
                  type="email"
                  value={identity.email}
                  onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                  className="bg-transparent text-white border-gray-600 focus-visible:ring-gray-400"
                />
                <div className="flex flex-col gap-1.5 w-full">
                  <label htmlFor="dev-role" className="text-sm font-medium text-gray-300">
                    Role
                  </label>
                  <select
                    id="dev-role"
                    className="flex h-12 w-full rounded-md border border-gray-600 bg-transparent px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                    value={identity.role}
                    onChange={(e) =>
                      setIdentity({ ...identity, role: e.target.value as DevIdentity["role"] })
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="finance">Finance</option>
                    <option value="approver">Approver</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Apply Identity
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
