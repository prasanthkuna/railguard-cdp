"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { api } from "../../../lib/api"
import { getErrorMessage } from "../../../lib/errors"

export default function CreateVendorPage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError("")

    try {
      const res = await api.createVendor({ name })
      router.push(`/vendors/${res.vendor.id}`)
    } catch (error) {
      setError(getErrorMessage(error, "Failed to create vendor"))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-[var(--rg-surface-secondary)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--rg-text-muted)]" />
        </button>
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Add Vendor
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendor Information</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Legal Name"
              placeholder="Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {error && <p className="text-sm text-[var(--rg-status-block)]">{error}</p>}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading} isLoading={loading}>
              Create Vendor
            </Button>
          </div>
        </Card>
      </form>
    </div>
  )
}
