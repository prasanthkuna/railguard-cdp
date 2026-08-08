"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { api } from "../../lib/api"
import { getErrorMessage } from "../../lib/errors"

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError("")

    try {
      await api.bootstrapWorkspace(name, email)
      router.push("/")
    } catch (error) {
      setError(getErrorMessage(error, "Failed to bootstrap workspace"))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--rg-shadow-md)]">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-brand)]">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Welcome to PreBroadcast</CardTitle>
          <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
            Create your operations workspace to enforce payment controls.
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <Input label="Workspace Name" placeholder="Example: Apex Treasury Ops" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <Input label="Owner Email (optional)" type="email" placeholder="finance-ops@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error ? <p className="text-sm text-[var(--rg-state-regret)]">{error}</p> : null}
          <Button type="submit" variant="primary" className="w-full" isLoading={loading} disabled={!name.trim()}>
            Initialize Workspace
          </Button>
        </form>
      </Card>
    </div>
  )
}
