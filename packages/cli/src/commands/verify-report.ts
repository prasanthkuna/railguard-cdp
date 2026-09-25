import { createClient } from "../client"
import type { RailguardEnv } from "../config"

export async function printExecutionVerifyReport(
  env: RailguardEnv,
  executionId: string,
): Promise<number> {
  const client = createClient(env)
  const result = await client.verify(executionId)
  const explain = result.explain as {
    evidenceValid?: boolean
    decision?: string
    settlement?: string
    policyVersion?: string
    requested?: string
  }

  const checks: Array<{ label: string; pass: boolean }> = [
    { label: "Intent binding", pass: Boolean(result.evidence.intentHash) },
    {
      label: "Budget invariant",
      pass: Boolean(result.evidence.authorizationGrantHash),
    },
    {
      label: "Recipient",
      pass: Boolean((explain as { merchant?: string }).merchant ?? result.evidence.intentHash),
    },
    {
      label: "At-most-once execution",
      pass: Boolean(result.evidence.execution.submissionId ?? result.evidence.execution.txHash),
    },
    {
      label: "Chain evidence",
      pass: Boolean(result.evidence.execution.txHash),
    },
    {
      label: "Reconciliation",
      pass:
        explain.settlement === "VERIFIED" ||
        ["FINALIZED", "SAFE", "INCLUDED"].includes(result.evidence.settlement.status),
    },
  ]

  for (const check of checks) {
    console.log(`${check.label.padEnd(24)} ${check.pass ? "PASS" : "FAIL"}`)
  }

  const allPass = checks.every((c) => c.pass) && (explain.evidenceValid ?? true)
  console.log("")
  console.log(allPass ? "EXECUTION VERIFIED" : "EXECUTION NOT VERIFIED")
  console.log(`executionId: ${executionId}`)
  if (result.evidence.execution.txHash) {
    console.log(`txHash: ${result.evidence.execution.txHash}`)
  }

  return allPass ? 0 : 1
}
