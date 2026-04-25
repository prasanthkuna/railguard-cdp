"use client"

import { LogOut, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { clearAuthSession, getAuthSession, isDevAuthEnabled } from "../../lib/auth"
import { useWorkspace } from "../../lib/hooks"
import { Button } from "../ui/Button"

export function Header() {
  const router = useRouter()
  const { workspace } = useWorkspace()
  const devAuthEnabled = isDevAuthEnabled()
  const session = React.useMemo(() => getAuthSession(), [])

  function handleSignOut() {
    clearAuthSession()
    router.replace("/login")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--rg-border)] bg-[var(--rg-surface-light)] px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-[var(--rg-text-primary)]">
          {workspace ? workspace.name : "Loading Workspace..."}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {devAuthEnabled ? (
          <div className="hidden items-center gap-2 rounded-full border border-[var(--rg-border)] bg-[var(--rg-surface-secondary)] px-3 py-1 text-xs font-medium sm:flex">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Dev Mode
          </div>
        ) : session ? (
          <div className="hidden rounded-full border border-[var(--rg-border)] bg-[var(--rg-surface-secondary)] px-3 py-1 text-xs font-medium text-[var(--rg-text-muted)] sm:flex">
            {session.email}
          </div>
        ) : null}

        <Link href="/invoices/upload">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Upload Invoice
          </Button>
        </Link>

        {!devAuthEnabled ? (
          <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        ) : null}
      </div>
    </header>
  )
}
