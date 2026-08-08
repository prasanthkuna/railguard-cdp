"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { api } from "../../../lib/api"
import { clearWorkOSAuthFlow, getWorkOSAuthFlow, setAuthSession } from "../../../lib/auth"
import { getErrorMessage } from "../../../lib/errors"

export function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    let cancelled = false

    async function finishSignIn() {
      const code = searchParams.get("code")
      const state = searchParams.get("state")
      const flow = getWorkOSAuthFlow()
      const redirectURI =
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`

      if (!code || !state || !flow) {
        if (!cancelled) setError("Missing WorkOS callback state. Restart sign-in and try again.")
        return
      }

      if (flow.state !== state) {
        clearWorkOSAuthFlow()
        if (!cancelled) setError("WorkOS state verification failed. Restart sign-in and try again.")
        return
      }

      try {
        const session = await api.workosExchange(code, redirectURI, flow.codeVerifier)
        if (cancelled) return

        setAuthSession({
          accessToken: session.accessToken,
          userID: session.userID,
          email: session.email,
          ...(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
          ...(session.sealedSession ? { sealedSession: session.sealedSession } : {}),
          organizationID:
            session.organizationID ||
            process.env.NEXT_PUBLIC_WORKOS_ORGANIZATION_ID?.trim() ||
            undefined,
        })
        clearWorkOSAuthFlow()
        router.replace("/")
      } catch (error) {
        clearWorkOSAuthFlow()
        if (!cancelled) setError(getErrorMessage(error, "Failed to finish WorkOS sign-in"))
      }
    }

    void finishSignIn()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-lg p-6 text-center md:p-8">
        <CardHeader className="items-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-accent-dim)]">
            <ShieldCheck className={`h-7 w-7 ${error ? "text-[var(--rg-state-regret)]" : "text-[var(--rg-accent)] rg-pulse-ring"}`} />
          </div>
          <CardTitle>{error ? "Sign-in failed" : "Completing sign-in"}</CardTitle>
          <p className="text-sm text-[var(--rg-text-muted)]">
            {error || "Finalizing your WorkOS session and loading the workspace."}
          </p>
        </CardHeader>
      </Card>
    </div>
  )
}
