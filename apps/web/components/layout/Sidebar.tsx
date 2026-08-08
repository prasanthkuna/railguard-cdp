"use client"

import { FileText, History, LayoutDashboard, Settings, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../../lib/cn"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/vendors", label: "Vendors", icon: Users },
  { href: "/audit", label: "Audit Trail", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-[var(--rg-border)] bg-[var(--rg-bg-base)] lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--rg-border)] px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--rg-radius-md)] bg-[var(--rg-brand)]">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="rg-headline text-[var(--rg-text-primary)]">PreBroadcast</p>
          <p className="rg-caption text-[var(--rg-text-muted)]">Built on Coinbase Developer Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-[var(--rg-radius-md)] px-3 py-2.5 rg-label-2 transition",
                isActive
                  ? "bg-[var(--rg-bg-primary-wash)] text-[var(--rg-brand)]"
                  : "text-[var(--rg-text-secondary)] hover:bg-[var(--rg-bg-hover)] hover:text-[var(--rg-text-primary)]",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-[var(--rg-brand)]" : "text-[var(--rg-text-muted)] group-hover:text-[var(--rg-text-secondary)]",
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--rg-border)] p-4">
        <div className="rounded-[var(--rg-radius-lg)] bg-[var(--rg-bg-primary-wash)] p-4">
          <p className="rg-caption text-[var(--rg-brand)]">Network</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--rg-state-joy)]" />
            <span className="rg-label-1 text-[var(--rg-text-primary)]">Base Sepolia</span>
          </div>
          <p className="rg-legal mt-2 text-[var(--rg-text-muted)]">Demo settlement mode</p>
        </div>
      </div>
    </aside>
  )
}
