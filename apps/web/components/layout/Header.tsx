"use client"

import { LogOut, Plus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"
import { clearAuthSession, getAuthSession, isDevAuthEnabled } from "../../lib/auth"
import { useWorkspace } from "../../lib/hooks"
import { Button } from "../ui/Button"

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/invoices": "Invoices",
  "/invoices/upload": "Upload Invoice",
  "/vendors": "Vendors",
  "/vendors/new": "Add Vendor",
  "/audit": "Audit Trail",
  "/settings": "Settings",
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { workspace } = useWorkspace()
  const devAuthEnabled = isDevAuthEnabled()
  const session = React.useMemo(() => getAuthSession(), [])

  const pageTitle =
    routeTitles[pathname || ""] ||
    (pathname?.startsWith("/invoices/") ? "Invoice Detail" : undefined) ||
    (pathname?.startsWith("/vendors/") ? "Vendor Detail" : undefined) ||
    "PreBroadcast"

  function handleSignOut() {
    clearAuthSession()
    router.replace("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[var(--rg-border)] bg-[var(--rg-bg-base)] px-4 md:px-6">
      <div className="min-w-0">
        <p className="truncate rg-caption normal-case text-[var(--rg-text-muted)]">
          {workspace?.name || "Workspace"}
        </p>
        <h1 className="truncate rg-headline text-[var(--rg-text-primary)]">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {devAuthEnabled ? (
          <div className="hidden items-center gap-2 rounded-[var(--rg-radius-pill)] border border-[var(--rg-border)] bg-[var(--rg-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--rg-text-secondary)] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[var(--rg-brand)]" />
            Dev Mode
          </div>
        ) : session ? (
          <div className="hidden max-w-[180px] truncate rounded-[var(--rg-radius-pill)] border border-[var(--rg-border)] bg-[var(--rg-bg-hover)] px-3 py-1.5 text-xs font-medium text-[var(--rg-text-muted)] sm:flex">
            {session.email}
          </div>
        ) : null}

        <Link href="/invoices/upload">
          <Button size="sm" variant="primary" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Invoice</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </Link>

        {!devAuthEnabled ? (
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        ) : null}
      </div>
    </header>
  )
}
