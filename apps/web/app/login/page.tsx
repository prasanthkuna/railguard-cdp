"use client"

import { Suspense } from "react"
import LoginPageContent from "./LoginPageContent"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6">
          <p className="text-sm text-[var(--rg-text-muted)]">Loading sign-in…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
