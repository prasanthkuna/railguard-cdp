"use client"

import { UploadCloud } from "lucide-react"
import * as React from "react"

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
      className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-[var(--rg-radius-lg)] transition-colors ${
        isDragging
          ? "border-[var(--rg-brand)] bg-[var(--rg-surface-secondary)]"
          : "border-[var(--rg-border)] bg-[var(--rg-surface-light)] hover:bg-[var(--rg-surface-secondary)]"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <UploadCloud className="w-10 h-10 mb-3 text-[var(--rg-text-muted)]" />
        <p className="mb-2 text-sm text-[var(--rg-text-muted)]">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-[var(--rg-text-muted)]">PDF, PNG, JPG (MAX. 10MB)</p>
      </div>
    </div>
  )
}
