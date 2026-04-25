"use client"

import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { hasAuthSession, isDevAuthEnabled } from "../../lib/auth"
import { useIsClient } from "../../lib/hooks"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isClient = useIsClient()
  const devAuthEnabled = isDevAuthEnabled()
  const isPublicRoute = pathname === "/login" || pathname?.startsWith("/auth/callback")
  const isAuthenticated = devAuthEnabled || hasAuthSession()

  React.useEffect(() => {
    if (isClient && !isPublicRoute && !isAuthenticated) {
      router.replace("/login")
    }
  }, [isAuthenticated, isClient, isPublicRoute, router])

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (!isClient || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rg-surface-subtle)] px-6">
        <div className="max-w-md rounded-[var(--rg-radius-lg)] border border-[var(--rg-border)] bg-[var(--rg-surface-light)] p-8 text-center shadow-[var(--rg-shadow-sm)]">
          <h2 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Checking access
          </h2>
          <p className="mt-3 text-sm text-[var(--rg-text-muted)]">
            Preparing your secure workspace session.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--rg-surface-light)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[var(--rg-surface-subtle)] p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
