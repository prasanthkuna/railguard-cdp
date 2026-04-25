"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { Button } from "../../../components/ui/Button"
import { Card, CardHeader, CardTitle } from "../../../components/ui/Card"
import { FileUpload } from "../../../components/ui/FileUpload"
import { Input } from "../../../components/ui/Input"
import { api } from "../../../lib/api"
import { getErrorMessage } from "../../../lib/errors"
import { useVendors } from "../../../lib/hooks"
import type { UploadInvoiceRequest } from "../../../lib/types"

export default function UploadInvoicePage() {
  const router = useRouter()
  const { vendors } = useVendors()
  const [file, setFile] = React.useState<File | null>(null)
  const [vendorID, setVendorID] = React.useState("")
  const [hints, setHints] = React.useState({
    invoiceNumber: "",
    amountBaseUnits: "",
    walletAddress: "",
    paymentMemo: "",
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  async function readFileAsBase64(input: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error("Failed to read file."))
      reader.onload = () => resolve(String(reader.result || ""))
      reader.readAsDataURL(input)
    })

    const base64 = dataUrl.split(",")[1]
    if (!base64) {
      throw new Error("Failed to read file.")
    }

    return base64
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a file to upload.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const base64 = await readFileAsBase64(file)
      const payload: UploadInvoiceRequest = {
        fileName: file.name,
        contentType: file.type,
        contentBase64: base64,
      }
      if (vendorID) payload.vendorID = vendorID
      if (hints.invoiceNumber) payload.invoiceNumberHint = hints.invoiceNumber
      if (hints.amountBaseUnits) payload.amountBaseUnitsHint = hints.amountBaseUnits
      if (hints.walletAddress) payload.walletAddressHint = hints.walletAddress
      if (hints.paymentMemo) payload.paymentMemoHint = hints.paymentMemo

      await api.uploadInvoice(payload)
      router.push("/invoices")
    } catch (error) {
      setError(getErrorMessage(error, "Upload failed"))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-[var(--rg-surface-secondary)] transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--rg-text-muted)]" />
        </button>
        <div>
          <h1 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
            Upload Invoice
          </h1>
          <p className="text-[var(--rg-text-muted)]">Upload a PDF or image for AI extraction.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document</CardTitle>
          </CardHeader>
          <FileUpload onFileSelect={setFile} />
          {file && (
            <div className="mt-4 flex items-center justify-between rounded-md bg-[var(--rg-surface-secondary)] px-4 py-3 text-sm">
              <span className="font-medium text-[var(--rg-text-primary)]">{file.name}</span>
              <span className="text-[var(--rg-text-muted)]">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Extraction Hints (Optional)</CardTitle>
            <p className="text-sm text-[var(--rg-text-muted)] mt-1">
              Provide hints to improve AI extraction accuracy, or leave blank to auto-detect.
            </p>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="vendor-id"
                className="text-sm font-medium text-[var(--rg-text-primary)]"
              >
                Vendor
              </label>
              <select
                id="vendor-id"
                className="flex h-12 w-full rounded-md border border-[var(--rg-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rg-brand)]"
                value={vendorID}
                onChange={(e) => setVendorID(e.target.value)}
              >
                <option value="">Auto-detect vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Invoice Number"
                placeholder="e.g. INV-2026"
                value={hints.invoiceNumber}
                onChange={(e) => setHints({ ...hints, invoiceNumber: e.target.value })}
              />
              <Input
                label="Amount (Base Units)"
                placeholder="e.g. 1000000000"
                value={hints.amountBaseUnits}
                onChange={(e) => setHints({ ...hints, amountBaseUnits: e.target.value })}
              />
            </div>
            <Input
              label="Wallet Address"
              placeholder="0x..."
              value={hints.walletAddress}
              onChange={(e) => setHints({ ...hints, walletAddress: e.target.value })}
            />
          </div>
        </Card>

        {error && <p className="text-sm text-[var(--rg-status-block)] font-medium">{error}</p>}

        <div className="flex justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file || loading} isLoading={loading}>
            Upload & Extract
          </Button>
        </div>
      </form>
    </div>
  )
}
