"use client"

import { UploadCloud } from "lucide-react"
import * as React from "react"
import { cn } from "../../lib/cn"

export interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
}

export function FileUpload({
  onFileSelect,
  accept = "application/pdf,image/png,image/jpeg",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files?.[0]) {
      onFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files?.[0]) {
      onFileSelect(e.target.files[0])
    }
  }

  return (
    <div
      className={cn(
        "relative flex h-64 w-full flex-col items-center justify-center rounded-[var(--rg-radius-lg)] border-2 border-dashed transition",
        isDragging
          ? "border-[var(--rg-brand)] bg-[var(--rg-bg-primary-wash)]"
          : "border-[var(--rg-border)] bg-[var(--rg-bg-base)] hover:border-[var(--rg-brand-muted)] hover:bg-[var(--rg-bg-primary-wash)]",
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 rounded-full bg-[var(--rg-bg-primary-wash)] p-3">
          <UploadCloud className="h-8 w-8 text-[var(--rg-brand)]" />
        </div>
        <p className="mb-1 text-sm text-[var(--rg-text-secondary)]">
          <span className="font-semibold text-[var(--rg-brand)]">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-[var(--rg-text-muted)]">PDF, PNG, JPG — max 10MB</p>
      </div>
    </div>
  )
}
