"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { BackLink, PageHeader, SectionCard } from "../../../components/design-system"
import { Button } from "../../../components/ui/Button"
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
      <BackLink label="Back" onClick={() => router.back()} />

      <PageHeader eyebrow="Counterparties" title="Add Vendor" description="Register a new approved payout counterparty." />

      <form onSubmit={handleSubmit}>
        <SectionCard title="Vendor Information">
          <Input label="Legal Name" placeholder="Acme Corp" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          {error ? <p className="mt-4 text-sm text-[var(--rg-state-regret)]">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>Cancel</Button>
            <Button type="submit" variant="accent" disabled={!name.trim() || loading} isLoading={loading}>Create Vendor</Button>
          </div>
        </SectionCard>
      </form>
    </div>
  )
}
