"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { api } from "../../lib/api"
import {
  getConfiguredOrganizationID,
  hasAuthSession,
  isDevAuthEnabled,
  setAuthSession,
  setWorkOSAuthFlow,
} from "../../lib/auth"
import { getErrorMessage } from "../../lib/errors"

function persistSession(session: {
  accessToken: string
  refreshToken?: string
  sealedSession?: string
  organizationID?: string
  userID: string
  email: string
}) {
  setAuthSession({
    accessToken: session.accessToken,
    userID: session.userID,
    email: session.email,
    ...(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
    ...(session.sealedSession ? { sealedSession: session.sealedSession } : {}),
    organizationID: session.organizationID || getConfiguredOrganizationID(),
  })
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState<"password" | "google" | null>(null)
  const [error, setError] = React.useState("")
  const devAuthEnabled = isDevAuthEnabled()

  React.useEffect(() => {
    if (devAuthEnabled || hasAuthSession()) {
      router.replace("/")
    }
  }, [devAuthEnabled, router])

  async function handlePasswordSignIn(event: React.FormEvent) {
    event.preventDefault()
    setLoading("password")
    setError("")

    try {
      const session = await api.workosPassword(
        email.trim(),
        password,
        getConfiguredOrganizationID(),
      )
      persistSession(session)
      router.replace("/")
    } catch (err) {
      setError(getErrorMessage(err, "Invalid email or password"))
      setLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    setLoading("google")
    setError("")

    try {
      const redirectURI =
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`
      const { url, state, codeVerifier } = await api.workosAuthorize(
        redirectURI,
        getConfiguredOrganizationID(),
        { provider: "GoogleOAuth", loginHint: email.trim() || undefined },
      )
      setWorkOSAuthFlow(state, codeVerifier)
      window.location.assign(url)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to start Google sign-in"))
      setLoading(null)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 12% -10%, rgba(0,82,255,0.14), transparent 55%), radial-gradient(900px 500px at 88% 110%, rgba(9,133,81,0.10), transparent 50%), linear-gradient(180deg, rgb(247,248,249) 0%, rgb(255,255,255) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(91,97,110,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(91,97,110,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--rg-brand)] shadow-[var(--rg-shadow-glow)]">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <p className="rg-caption text-[var(--rg-brand)]">PreBroadcast</p>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[var(--rg-text-primary)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
            Policy before USDC broadcast — one workspace, no detours.
          </p>
        </div>

        <div className="rounded-[20px] border border-[var(--rg-border)] bg-white/90 p-6 shadow-[var(--rg-shadow-md)] backdrop-blur-sm md:p-7">
          <form className="space-y-4" onSubmit={handlePasswordSignIn}>
            <Input
              label="Work email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={loading === "password"}
              disabled={loading !== null}
            >
              Sign in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--rg-border)]" />
            <span className="rg-caption text-[var(--rg-text-muted)]">or</span>
            <div className="h-px flex-1 bg-[var(--rg-border)]" />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            isLoading={loading === "google"}
            disabled={loading !== null}
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </Button>

          {error ? <p className="mt-4 text-sm text-[var(--rg-state-regret)]">{error}</p> : null}
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-[var(--rg-text-muted)]">
          Sessions stay on this device. Google goes straight to Google — no hosted AuthKit round-trip.
        </p>
      </div>
    </div>
  )
}
