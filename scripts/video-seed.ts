/**
 * Seed staging demo data and write a video capture manifest.
 * Run: bun run video:seed
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PIPELINE_DIR = join(ROOT, "apps", "video", "capcut-pipeline")
const MANIFEST_PATH = join(PIPELINE_DIR, "manifest.json")

const DEFAULT_WEB_URL = "https://web-ruddy-three-69.vercel.app"
const DEFAULT_API_URL = "https://staging-railguard-s4ii.encr.app"

interface VerifyResult {
  ok: boolean
  baseURL?: string
  activeOrgID?: string
  workspace?: string
  created?: {
    allowInvoice?: string
    escalatedInvoice?: string
    blockedInvoice?: string
    uploadedInvoice?: string
    paymentIntent?: string
    csvExport?: string
    pdfExport?: string
  }
  error?: string
}

function env(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback
}

function parseVerifyStdout(stdout: string): VerifyResult | null {
  const blocks = stdout.match(/\{[\s\S]*?\n\}/g)
  if (!blocks?.length) return null
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(blocks[index]!) as VerifyResult
      if (typeof parsed.ok === "boolean") return parsed
    } catch {
      // keep scanning
    }
  }
  return null
}

function runIDFromOrg(orgId: string): string | null {
  const match = /^org_curated_(\d{14})$/.exec(orgId)
  return match?.[1] ?? null
}

function main() {
  const apiUrl = env("RAILGUARD_BASE_URL", DEFAULT_API_URL)
  const webUrl = env("RAILGUARD_WEB_URL", DEFAULT_WEB_URL)

  console.log(`[video-seed] verify:demo against ${apiUrl}`)
  const result = spawnSync("bun", ["run", "verify:demo"], {
    cwd: ROOT,
    env: { ...process.env, RAILGUARD_BASE_URL: apiUrl },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  const verify = parseVerifyStdout(result.stdout ?? "")
  if (!verify?.ok || !verify.activeOrgID || !verify.created) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          step: "verify:demo",
          exitCode: result.status,
          error: verify?.error ?? "Could not parse verify:demo JSON result",
        },
        null,
        2,
      ),
    )
    process.exit(result.status === 0 ? 1 : (result.status ?? 1))
  }

  const runID =
    env("RAILGUARD_RUN_ID", "") ||
    runIDFromOrg(verify.activeOrgID) ||
    new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)

  const manifest = {
    generatedAt: new Date().toISOString(),
    product: "PreBroadcast",
    webUrl,
    apiUrl: verify.baseURL ?? apiUrl,
    runID,
    orgId: verify.activeOrgID,
    workspace: verify.workspace ?? null,
    viewport: { width: 2560, height: 1600 },
    invoices: {
      allow: verify.created.allowInvoice,
      escalate: verify.created.escalatedInvoice,
      blocked: verify.created.blockedInvoice,
      upload: verify.created.uploadedInvoice,
    },
    invoiceNumbers: {
      allow: `RG-ALLOW-${runID}`,
      escalate: `RG-ESCALATE-${runID}`,
      upload: `RG-UPLOAD-${runID}`,
    },
    scenes: [
      {
        id: "01-dashboard",
        title: "Control Center",
        path: "/",
        waitFor: "Total Protected",
        holdMs: 3500,
        clipSeconds: 6,
        motion: "zoom-in",
        caption: "Every vendor payment starts with policy — not hope.",
      },
      {
        id: "02-inbox",
        title: "Invoice Inbox",
        path: "/invoices",
        waitFor: `RG-ALLOW-${runID}`,
        holdMs: 3500,
        clipSeconds: 5,
        motion: "pan-right",
        caption: "Invoices land in one inbox. Risk is scored before money moves.",
      },
      {
        id: "03-blocked-hero",
        title: "Blocked Payment",
        path: `/invoices/${verify.created.blockedInvoice}`,
        waitFor: "wallet.changed",
        holdMs: 5000,
        scroll: true,
        clipSeconds: 10,
        motion: "hero-tilt",
        caption: "Duplicate invoice + wallet swap = blocked. No USDC leaves treasury.",
      },
      {
        id: "04-escalate",
        title: "Approve and Execute",
        path: `/invoices/${verify.created.escalatedInvoice}`,
        waitFor: "payment_intent.executed",
        holdMs: 4500,
        scroll: true,
        clipSeconds: 7,
        motion: "pull-back",
        caption: "Human approval, then on-chain execution with a full audit trail.",
      },
      {
        id: "05-ready",
        title: "Ready to Pay",
        path: `/invoices/${verify.created.allowInvoice}`,
        waitFor: "Create Payment",
        holdMs: 3000,
        clipSeconds: 4,
        motion: "float",
        caption: "Clean invoices move straight to payment intent.",
      },
      {
        id: "06-audit",
        title: "Audit Trail",
        path: "/audit",
        waitFor: "Audit Trail",
        holdMs: 2500,
        auditSearch: true,
        clipSeconds: 6,
        motion: "gentle-zoom",
        caption: "CSV and PDF exports for finance and compliance.",
      },
    ],
    endCard: {
      title: "PreBroadcast",
      url: webUrl,
      tagline: "Policy before USDC broadcast.",
      seconds: 5,
    },
    terminalProfiles: ["APF-003", "APF-001", "APF-004"],
  }

  mkdirSync(PIPELINE_DIR, { recursive: true })
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log(`[video-seed] wrote ${MANIFEST_PATH}`)
  console.log(JSON.stringify({ ok: true, manifestPath: MANIFEST_PATH, orgId: manifest.orgId }, null, 2))
}

main()
