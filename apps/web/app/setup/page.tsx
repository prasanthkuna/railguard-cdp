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
    <div className="flex min-h-screen items-center justify-center bg-[var(--rg-surface-subtle)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--rg-surface-secondary)]">
            <ShieldCheck className="h-6 w-6 text-[var(--rg-brand)]" />
          </div>
          <CardTitle>Welcome to Railguard</CardTitle>
          <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
            Create your operations workspace to enforce payment controls.
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Workspace Name"
            placeholder="Example: Apex Treasury Ops"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Owner Email (optional)"
            type="email"
            placeholder="finance-ops@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && <p className="text-sm text-[var(--rg-status-block)]">{error}</p>}

          <Button type="submit" className="w-full" isLoading={loading} disabled={!name.trim()}>
            Initialize Workspace
          </Button>
        </form>
      </Card>
    </div>
  )
}
