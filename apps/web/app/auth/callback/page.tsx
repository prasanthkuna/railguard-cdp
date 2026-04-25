import { Suspense } from "react"
import { CallbackContent } from "./CallbackContent"

export default function WorkOSCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--rg-surface-subtle)] px-6 py-10">
          <div className="w-full max-w-lg rounded-[var(--rg-radius-lg)] border border-[var(--rg-border)] bg-[var(--rg-surface-light)] p-8 text-center shadow-[var(--rg-shadow-sm)]">
            <h2 className="text-3xl font-display tracking-tight text-[var(--rg-text-primary)]">
              Completing sign-in
            </h2>
            <p className="mt-3 text-sm text-[var(--rg-text-muted)]">
              Finalizing your WorkOS session and loading the workspace.
            </p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
