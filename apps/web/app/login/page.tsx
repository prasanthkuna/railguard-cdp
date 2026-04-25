"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../components/ui/Card"
import { api } from "../../lib/api"
import { hasAuthSession, isDevAuthEnabled, setWorkOSAuthFlow } from "../../lib/auth"
import { getErrorMessage } from "../../lib/errors"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const devAuthEnabled = isDevAuthEnabled()

  React.useEffect(() => {
    if (devAuthEnabled || hasAuthSession()) {
      router.replace("/")
    }
  }, [devAuthEnabled, router])

  async function handleSignIn() {
    setLoading(true)
    setError("")

    try {
      const redirectURI =
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`
      const { url, state, codeVerifier } = await api.workosAuthorize(redirectURI)
      setWorkOSAuthFlow(state, codeVerifier)
      window.location.assign(url)
    } catch (error) {
      setError(getErrorMessage(error, "Failed to start WorkOS sign-in"))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rg-surface-subtle)] px-6 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-surface-secondary)]">
            <ShieldCheck className="h-7 w-7 text-[var(--rg-brand)]" />
          </div>
          <CardTitle>Sign in to Railguard</CardTitle>
          <p className="max-w-md text-sm text-[var(--rg-text-muted)]">
            Use your WorkOS organization session to access invoice review, approvals, and audit
            workflows.
          </p>
        </CardHeader>

        <div className="space-y-4">
          <Button type="button" className="w-full" isLoading={loading} onClick={handleSignIn}>
            Continue with WorkOS
          </Button>
          {error ? <p className="text-sm text-[var(--rg-status-block)]">{error}</p> : null}
          <p className="text-xs text-[var(--rg-text-muted)]">
            If sign-in fails, confirm `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and your callback URL
            are configured in Encore and Vercel.
          </p>
        </div>
      </Card>
    </div>
  )
}
