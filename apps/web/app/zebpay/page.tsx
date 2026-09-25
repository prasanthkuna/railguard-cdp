import type { Metadata } from "next"
import Link from "next/link"
import { PageHeader, SectionCard } from "../../components/design-system"

export const metadata: Metadata = {
  title: "Railguard — ZebPay Web3 Pitch",
  description:
    "Financial execution assurance for autonomous Ethereum agents — policy, UNKNOWN reconciliation, and verifiable evidence.",
}

const PROTOCOL_PORTFOLIO =
  "https://github.com/prasanthkuna/railguard-protocol/blob/master/docs/PORTFOLIO.md"
const CDP_REPO = "https://github.com/prasanthkuna/railguard-cdp"
const FAILURE_LAB = "https://github.com/prasanthkuna/agent-payment-failure-lab"
const PREBROADCAST = "https://prebroadcast.vercel.app"

const PROOF_LINKS = [
  {
    title: "Portfolio (start here)",
    href: PROTOCOL_PORTFOLIO,
    detail: "10-minute reviewer path, honest gaps, live evidence index",
  },
  {
    title: "Control plane + MCP",
    href: CDP_REPO,
    detail: "authorize → execute → reconcile → GET /v1/executions/:id/evidence",
  },
  {
    title: "PreBroadcast demo",
    href: PREBROADCAST,
    detail: "Hosted console — policy before USDC broadcast (Base Sepolia)",
  },
  {
    title: "Failure lab",
    href: FAILURE_LAB,
    detail: "APF-001..006 — concurrency, post-broadcast UNKNOWN, settlement mismatch",
  },
] as const

const FAILURES = [
  "RPC timeout after broadcast → UNKNOWN, not false failed",
  "Duplicate retry → idempotent execution digest",
  "Shared budget race → atomic reservation",
  "Intent mismatch → immutable authorization binding",
] as const

const STACK = [
  "EIP-712 typed intents",
  "ERC-4337 session path + SignGate cosign",
  "ERC-7579 execution hook (on-chain ceiling)",
  "Base Sepolia live settlement evidence",
] as const

export default function ZebPayPitchPage() {
  return (
    <div className="min-h-screen bg-[var(--rg-bg-alternate)]">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <PageHeader
          eyebrow="ZebPay Web3 Pitch · Devcon Mumbai 2026"
          title="Financial Execution Assurance for Autonomous Ethereum Agents"
          description="A valid signature proves authority. It does not prove the economic action was correct."
        />

        <p className="rg-body -mt-4 text-[var(--rg-text-muted)]">
          Railguard binds agent intent to reserved budget, execution, and reconciled chain reality —
          with evidence you can inspect in under ten minutes.
        </p>

        <div className="mt-10 space-y-6">
          <SectionCard title="What we built">
            <ul className="rg-body list-disc space-y-2 pl-5 text-[var(--rg-text-primary)]">
              {STACK.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Failures we prove (not slides)">
            <ul className="rg-body list-disc space-y-2 pl-5 text-[var(--rg-text-primary)]">
              {FAILURES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Proof links">
            <ul className="space-y-4">
              {PROOF_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="font-medium text-[var(--rg-brand)] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.title}
                  </a>
                  <p className="rg-body mt-1 text-sm text-[var(--rg-text-muted)]">{link.detail}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="CLI (reviewers)">
            <pre className="overflow-x-auto rounded-lg bg-[var(--rg-bg-primary)] p-4 font-mono text-sm text-[var(--rg-text-primary)]">
              {`bun run railguard doctor --base-url https://staging-railguard-s4ii.encr.app
bun run railguard verify <executionId> --base-url <API>`}
            </pre>
          </SectionCard>

          <SectionCard title="Status">
            <p className="rg-body text-[var(--rg-text-muted)]">
              v0.1 reference implementation — production gaps (deep reorg, HSM/MPC) documented in{" "}
              <a
                href={PROTOCOL_PORTFOLIO}
                className="text-[var(--rg-brand)] hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                PORTFOLIO.md
              </a>
              . Not positioned as a wallet or custody product.
            </p>
          </SectionCard>
        </div>

        <p className="rg-body mt-10 text-center text-sm text-[var(--rg-text-muted)]">
          <Link href="/login" className="text-[var(--rg-brand)] hover:underline">
            Operator login
          </Link>
          {" · "}
          <a href={PREBROADCAST} className="text-[var(--rg-brand)] hover:underline">
            Open PreBroadcast
          </a>
        </p>
      </div>
    </div>
  )
}
