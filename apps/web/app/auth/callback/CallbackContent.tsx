"use client"

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
        if (!cancelled) {
          setError("Missing WorkOS callback state. Restart sign-in and try again.")
        }
        return
      }

      if (flow.state !== state) {
        clearWorkOSAuthFlow()
        if (!cancelled) {
          setError("WorkOS state verification failed. Restart sign-in and try again.")
        }
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
          ...(session.organizationID ? { organizationID: session.organizationID } : {}),
        })
        clearWorkOSAuthFlow()
        router.replace("/")
      } catch (error) {
        clearWorkOSAuthFlow()
        if (!cancelled) {
          setError(getErrorMessage(error, "Failed to finish WorkOS sign-in"))
        }
      }
    }

    void finishSignIn()
    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--rg-surface-subtle)] px-6 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle>{error ? "Sign-in failed" : "Completing sign-in"}</CardTitle>
          <p className="text-sm text-[var(--rg-text-muted)]">
            {error || "Finalizing your WorkOS session and loading the workspace."}
          </p>
        </CardHeader>
      </Card>
    </div>
  )
}
