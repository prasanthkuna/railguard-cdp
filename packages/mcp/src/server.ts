/**
 * Minimal MCP stdio server (JSON-RPC 2.0) — no external SDK dependency.
 * Implements tools/list + tools/call for Railguard v5 verbs.
 */
import { createInterface } from "node:readline"
import {
  toolAuthorize,
  toolCreateIntent,
  toolDoctor,
  toolExecute,
  toolGetExecution,
  toolMetrics,
  toolPay,
  toolVerify,
} from "./tools"

const TOOLS = [
  {
    name: "railguard_doctor",
    description: "Check Railguard API connectivity and environment configuration",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "railguard_create_intent",
    description: "Create a v5 FinancialIntent (POST /v1/intents)",
    inputSchema: {
      type: "object",
      required: ["intent"],
      properties: { intent: { type: "object" } },
    },
  },
  {
    name: "railguard_authorize",
    description: "Authorize a financial intent",
    inputSchema: {
      type: "object",
      required: ["intentId"],
      properties: { intentId: { type: "string" } },
    },
  },
  {
    name: "railguard_execute",
    description: "Execute an authorized intent",
    inputSchema: {
      type: "object",
      required: ["intentId"],
      properties: {
        intentId: { type: "string" },
        paymentIntentId: { type: "string" },
      },
    },
  },
  {
    name: "railguard_verify",
    description: "Verify execution and fetch evidence envelope",
    inputSchema: {
      type: "object",
      required: ["executionId"],
      properties: { executionId: { type: "string" } },
    },
  },
  {
    name: "railguard_pay",
    description: "Create → authorize → execute → verify",
    inputSchema: {
      type: "object",
      required: ["intent"],
      properties: {
        intent: { type: "object" },
        paymentIntentId: { type: "string" },
      },
    },
  },
  {
    name: "railguard_get_execution",
    description: "Get execution status",
    inputSchema: {
      type: "object",
      required: ["executionId"],
      properties: { executionId: { type: "string" } },
    },
  },
  {
    name: "railguard_financial_metrics",
    description: "Financial SRE metrics",
    inputSchema: { type: "object", properties: {} },
  },
] as const

async function dispatchTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "railguard_doctor":
      return toolDoctor()
    case "railguard_create_intent":
      return toolCreateIntent(args.intent as never)
    case "railguard_authorize":
      return toolAuthorize(String(args.intentId))
    case "railguard_execute":
      return toolExecute(String(args.intentId), args.paymentIntentId as string | undefined)
    case "railguard_verify":
      return toolVerify(String(args.executionId))
    case "railguard_pay":
      return toolPay(args.intent as never, args.paymentIntentId as string | undefined)
    case "railguard_get_execution":
      return toolGetExecution(String(args.executionId))
    case "railguard_financial_metrics":
      return toolMetrics()
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function reply(id: unknown, result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`)
}

function replyError(id: unknown, code: number, message: string): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`)
}

async function handleMessage(raw: string): Promise<void> {
  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  if (msg.jsonrpc !== "2.0" || msg.method === undefined) return

  const { id, method, params = {} } = msg

  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "railguard", version: "0.5.0" },
      })
      return
    }
    if (method === "notifications/initialized" || method === "initialized") {
      return
    }
    if (method === "tools/list") {
      reply(id, { tools: TOOLS })
      return
    }
    if (method === "tools/call") {
      const name = String(params.name ?? "")
      const args = (params.arguments ?? {}) as Record<string, unknown>
      try {
        const result = await dispatchTool(name, args)
        reply(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        reply(id, {
          content: [{ type: "text", text: JSON.stringify({ error: message }) }],
          isError: true,
        })
      }
      return
    }
    if (method === "ping") {
      reply(id, {})
      return
    }
    replyError(id, -32601, `Method not found: ${method}`)
  } catch (error) {
    replyError(id, -32603, error instanceof Error ? error.message : String(error))
  }
}

const rl = createInterface({ input: process.stdin, terminal: false })
rl.on("line", (line) => {
  void handleMessage(line)
})
