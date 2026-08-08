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
      const organizationID = process.env.NEXT_PUBLIC_WORKOS_ORGANIZATION_ID?.trim() || undefined
      const { url, state, codeVerifier } = await api.workosAuthorize(redirectURI, organizationID)
      setWorkOSAuthFlow(state, codeVerifier)
      window.location.assign(url)
    } catch (error) {
      setError(getErrorMessage(error, "Failed to start WorkOS sign-in"))
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="relative w-full max-w-lg shadow-[var(--rg-shadow-md)]">
        <CardHeader className="items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-brand)]">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Sign in to PreBroadcast</CardTitle>
          <p className="max-w-md text-sm text-[var(--rg-text-muted)]">
            Secure invoice review, approvals, and audit — styled with Coinbase Design System colors.
          </p>
        </CardHeader>

        <div className="space-y-4">
          <Button type="button" variant="primary" className="w-full" isLoading={loading} onClick={handleSignIn}>
            Continue with WorkOS
          </Button>
          {error ? <p className="text-sm text-[var(--rg-state-regret)]">{error}</p> : null}
          <p className="text-xs text-[var(--rg-text-muted)]">
            If sign-in fails, confirm WorkOS Redirect URIs include{" "}
            <code className="text-[11px]">https://prebroadcast.vercel.app/auth/callback</code> and that your user
            belongs to organization <code className="text-[11px]">PreBroadcast</code>.
          </p>
        </div>
      </Card>
    </div>
  )
}
