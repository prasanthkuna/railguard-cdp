"use client"

import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import * as React from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { api } from "../../../lib/api"
import { clearWorkOSAuthFlow, getWorkOSAuthFlow, setAuthSession } from "../../../lib/auth"
import { getErrorMessage } from "../../../lib/errors"

export function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = React.useState("")
  const startedRef = React.useRef(false)

  React.useEffect(() => {
    // OAuth codes are single-use. Guard against React Strict Mode / remounts
    // that would cancel or double-exchange the same code.
    if (startedRef.current) return
    startedRef.current = true

    async function finishSignIn() {
      const oauthError = searchParams.get("error")
      const oauthDescription = searchParams.get("error_description")
      if (oauthError) {
        const message = (oauthDescription || oauthError).replace(/\+/g, " ")
        clearWorkOSAuthFlow()
        setError(message)
        return
      }

      const code = searchParams.get("code")
      const state = searchParams.get("state")
      const flow = getWorkOSAuthFlow()
      const redirectURI =
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`

      if (!code || !state) {
        setError("Missing authorization code. Restart sign-in and try again.")
        return
      }

      if (!flow) {
        setError("Sign-in session expired in this browser tab. Restart sign-in and try again.")
        return
      }

      if (flow.state !== state) {
        clearWorkOSAuthFlow()
        setError("WorkOS state verification failed. Restart sign-in and try again.")
        return
      }

      try {
        const session = await api.workosExchange(code, redirectURI, flow.codeVerifier)
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
        setError(getErrorMessage(error, "Failed to finish Google sign-in"))
      }
    }

    void finishSignIn()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-lg p-6 text-center md:p-8">
        <CardHeader className="items-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-accent-dim)]">
            <ShieldCheck
              className={`h-7 w-7 ${error ? "text-[var(--rg-state-regret)]" : "text-[var(--rg-accent)] rg-pulse-ring"}`}
            />
          </div>
          <CardTitle>{error ? "Sign-in failed" : "Completing sign-in"}</CardTitle>
          <p className="text-sm text-[var(--rg-text-muted)]">
            {error || "Finalizing your session and loading the workspace."}
          </p>
        </CardHeader>
        {error ? (
          <div className="mt-6">
            <Link href={`/login?auth_error=${encodeURIComponent(error)}`}>
              <Button type="button" variant="secondary" className="w-full">
                Back to sign in
              </Button>
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
