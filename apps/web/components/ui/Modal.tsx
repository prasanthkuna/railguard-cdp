"use client"

import { X } from "lucide-react"
import type * as React from "react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 sm:p-0">
      <div className="relative w-full max-w-lg rounded-[var(--rg-radius-lg)] bg-[var(--rg-surface-light)] shadow-[var(--rg-shadow-lg)] sm:my-8">
        <div className="flex items-center justify-between border-b border-[var(--rg-border)] p-4 sm:p-6">
          <h3 className="text-xl font-semibold text-[var(--rg-text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 transition-colors hover:bg-[var(--rg-surface-secondary)]"
          >
            <X className="h-5 w-5 text-[var(--rg-text-muted)]" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  )
}
