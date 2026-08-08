"use client"

import { ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
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

type AuthMode = "signin" | "signup"

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

export default function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = React.useState<AuthMode>("signin")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState<"password" | "google" | null>(null)
  const [error, setError] = React.useState("")
  const devAuthEnabled = isDevAuthEnabled()

  React.useEffect(() => {
    const oauthError =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      searchParams.get("auth_error")
    if (oauthError) {
      setError(oauthError.replace(/\+/g, " "))
    }
  }, [searchParams])

  React.useEffect(() => {
    if (devAuthEnabled || hasAuthSession()) {
      router.replace("/")
    }
  }, [devAuthEnabled, router])

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading("password")
    setError("")

    try {
      const organizationID = getConfiguredOrganizationID()
      const session =
        mode === "signup"
          ? await api.workosSignup(email.trim(), password, organizationID)
          : await api.workosPassword(email.trim(), password, organizationID)
      persistSession(session)
      router.replace("/")
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          mode === "signup" ? "Unable to create account" : "Invalid email or password",
        ),
      )
      setLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    setLoading("google")
    setError("")

    try {
      const redirectURI =
        process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI || `${window.location.origin}/auth/callback`
      // Do not pass organizationID for GoogleOAuth — WorkOS rejects it as SSO connection lookup.
      const { url, state, codeVerifier } = await api.workosAuthorize(redirectURI, undefined, {
        provider: "GoogleOAuth",
        loginHint: email.trim() || undefined,
      })
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
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-[var(--rg-text-muted)]">
            Policy before USDC broadcast — one workspace, no detours.
          </p>
        </div>

        <div className="rounded-[20px] border border-[var(--rg-border)] bg-white/90 p-6 shadow-[var(--rg-shadow-md)] backdrop-blur-sm md:p-7">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-[12px] bg-[var(--rg-bg-alternate)] p-1">
            <button
              type="button"
              className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
                mode === "signin"
                  ? "bg-white text-[var(--rg-text-primary)] shadow-sm"
                  : "text-[var(--rg-text-muted)]"
              }`}
              onClick={() => {
                setMode("signin")
                setError("")
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition ${
                mode === "signup"
                  ? "bg-white text-[var(--rg-text-primary)] shadow-sm"
                  : "text-[var(--rg-text-muted)]"
              }`}
              onClick={() => {
                setMode("signup")
                setError("")
              }}
            >
              Sign up
            </button>
          </div>

          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
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
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              hint={mode === "signup" ? "At least 8 characters" : undefined}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={loading === "password"}
              disabled={loading !== null}
            >
              {mode === "signup" ? "Create account" : "Sign in"}
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
          Google works for new and existing accounts. After Google auth we attach you to the
          PreBroadcast workspace automatically.
        </p>
      </div>
    </div>
  )
}
