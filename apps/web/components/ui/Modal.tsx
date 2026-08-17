"use client"

import { X } from "lucide-react"
import type * as React from "react"
import { cn } from "../../lib/cn"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-[rgba(50,53,61,0.33)] p-4">
      <div
        className="relative w-full max-w-lg animate-fade-up rounded-[var(--rg-radius-xl)] border border-[var(--rg-border)] bg-[var(--rg-bg-base)] shadow-[var(--rg-shadow-md)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-[var(--rg-border)] p-5 sm:p-6">
          <div>
            <h3 className="rg-title-3 text-[var(--rg-text-primary)]">{title}</h3>
            {description ? <p className="rg-body mt-1 text-[var(--rg-text-muted)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 transition hover:bg-[var(--rg-bg-hover)]"
          >
            <X className="h-5 w-5 text-[var(--rg-text-muted)]" />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  )
}

export function ModalActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-3 pt-4", className)}>{children}</div>
}
