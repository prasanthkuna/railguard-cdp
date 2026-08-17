import { Suspense } from "react"
import { CallbackContent } from "./CallbackContent"

export default function WorkOSCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 py-10">
          <div className="rg-glass w-full max-w-lg rounded-[var(--rg-radius-xl)] p-8 text-center">
            <h2 className="font-display text-2xl font-medium tracking-tight text-[var(--rg-text-primary)]">
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
