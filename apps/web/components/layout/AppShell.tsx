"use client"

import { ShieldCheck } from "lucide-react"
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
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname?.startsWith("/auth/callback")
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--rg-bg-alternate)] px-6">
        <div className="rg-card max-w-md rounded-[var(--rg-radius-xl)] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--rg-bg-primary-wash)]">
            <ShieldCheck className="h-7 w-7 text-[var(--rg-brand)] rg-pulse-ring" />
          </div>
          <h2 className="rg-title-1 tracking-tight text-[var(--rg-text-primary)]">Checking access</h2>
          <p className="rg-body mt-3 text-[var(--rg-text-muted)]">Preparing your PreBroadcast workspace.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--rg-bg-alternate)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="rg-page-enter mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
