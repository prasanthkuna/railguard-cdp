#!/usr/bin/env bun
import { parseArgs } from "node:util"
import { resolveRailguardEnv } from "./config"
import { runDoctor, runLab, runVerify } from "./commands/ops"
import {
  runAuthorize,
  runEvidence,
  runExecute,
  runIntentCreate,
  runMetrics,
  runPay,
} from "./commands/v5"

const HELP = `Railguard CLI v0.5 — agent treasury control plane

Usage:
  railguard doctor [--base-url URL]
  railguard verify [--base-url URL]
  railguard lab [apf-lab args...]
  railguard metrics [--base-url URL]
  railguard evidence <executionId> [--base-url URL]
  railguard intent create [file.json] [--base-url URL]
  railguard authorize <intentId> [--base-url URL]
  railguard execute <intentId> [--payment-intent-id ID] [--base-url URL]
  railguard pay [file.json] [--payment-intent-id ID] [--base-url URL]

Environment:
  RAILGUARD_BASE_URL       API base (default http://localhost:4000)
  RAILGUARD_ACCESS_TOKEN   Bearer token for v5 API calls
`

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    "base-url": { type: "string" },
    "payment-intent-id": { type: "string" },
  },
  allowPositionals: true,
  strict: false,
})

async function main(): Promise<number> {
  if (values.help) {
    console.log(HELP)
    return 0
  }

  const env = resolveRailguardEnv({
    baseUrl: values["base-url"] as string | undefined,
  })

  const [cmd, sub, arg] = positionals

  if (!cmd) {
    console.log(HELP)
    return 1
  }

  try {
    switch (cmd) {
      case "doctor":
        runDoctor(env)
        return 0
      case "verify":
        return runVerify(env)
      case "lab":
        return runLab(positionals.slice(1))
      case "metrics":
        await runMetrics(env)
        return 0
      case "evidence":
        if (!sub) throw new Error("usage: railguard evidence <executionId>")
        await runEvidence(env, sub)
        return 0
      case "intent":
        if (sub !== "create") throw new Error("usage: railguard intent create [file.json]")
        await runIntentCreate(env, arg)
        return 0
      case "authorize":
        if (!sub) throw new Error("usage: railguard authorize <intentId>")
        await runAuthorize(env, sub)
        return 0
      case "execute":
        if (!sub) throw new Error("usage: railguard execute <intentId>")
        await runExecute(env, sub, values["payment-intent-id"] as string | undefined)
        return 0
      case "pay":
        await runPay(env, sub, values["payment-intent-id"] as string | undefined)
        return 0
      default:
        console.error(`unknown command: ${cmd}\n`)
        console.log(HELP)
        return 1
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exit(await main())
