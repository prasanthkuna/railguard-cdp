"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { api } from "./api"

export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR("/dashboard", api.getDashboard)
  return { data, error, isLoading, mutate }
}

export function useWorkspace() {
  const { data, error, isLoading, mutate } = useSWR("/workspace", api.getWorkspace)
  return { workspace: data?.workspace, error, isLoading, mutate }
}

export function useInvoices(status?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    status ? `/invoices?status=${status}` : "/invoices",
    () => api.listInvoices(status),
  )
  return { invoices: data?.invoices || [], error, isLoading, mutate }
}

export function useInvoice(id?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/invoices/${id}` : null,
    id ? () => api.getInvoice(id) : null,
  )
  return { ...data, error, isLoading, mutate }
}

export function useVendors() {
  const { data, error, isLoading, mutate } = useSWR("/vendors", api.listVendors)
  return { vendors: data?.vendors || [], error, isLoading, mutate }
}

export function useVendor(id?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/vendors/${id}` : null,
    id ? () => api.getVendor(id) : null,
  )
  return { ...data, error, isLoading, mutate }
}

// Ensure hydration doesn't cause mismatch for auth-dependent components
export function useIsClient() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  return isClient
}
