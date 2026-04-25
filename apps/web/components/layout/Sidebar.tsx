"use client"

import { FileText, History, LayoutDashboard, Settings, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

export function Sidebar() {
  const pathname = usePathname()

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/invoices", label: "Invoices", icon: FileText },
    { href: "/vendors", label: "Vendors", icon: Users },
    { href: "/audit", label: "Audit Trail", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="flex h-full w-64 flex-col border-r border-[var(--rg-border)] bg-[var(--rg-surface-light)]">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-[var(--rg-brand)]" />
          <span className="text-xl font-display font-semibold tracking-tight text-[var(--rg-text-primary)]">
            Railguard
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--rg-surface-secondary)] text-[var(--rg-brand)]"
                  : "text-[var(--rg-text-muted)] hover:bg-[var(--rg-surface-secondary)] hover:text-[var(--rg-text-primary)]"
              }`}
            >
              <item.icon
                className={`h-5 w-5 ${isActive ? "text-[var(--rg-brand)]" : "text-[var(--rg-text-muted)]"}`}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4">
        <div className="rounded-md bg-[var(--rg-surface-card-dark)] p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Environment
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm">Base Sepolia</span>
          </div>
        </div>
      </div>
    </div>
  )
}
