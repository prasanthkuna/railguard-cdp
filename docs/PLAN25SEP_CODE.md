# plan25sep.md — code implementation map

Excludes **image/video generation** per owner request.

## Product §2

| Item | Code |
|------|------|
| OBSERVE / GUARD / ENFORCE | `RAILGUARD_ASSURANCE_MODE`, `@railguard/integrations` |
| `railguard doctor` | `packages/cli/src/commands/doctor.ts` + `GET /v1/posture/summary` |
| `railguard protect` | `packages/cli/src/commands/protect.ts` |
| `railguard verify <intent\|exec>` | `verify-report.ts` + `GET /v1/intents/:id/verify` |

## §3 P0 (partial — reference impl)

| Primitive | Location |
|-----------|----------|
| Postgres money state | `apps/api/migrations`, `financial_intents` |
| Idempotency | `execution_attempts`, CDP driver tests |
| Outbox | `migrations/010_v4_domain_outbox` |
| State machine | `packages/kernel/executionRail.ts` |
| Reorg metadata | `migrations/012_chain_reorg_metadata` |
| Signer boundary | `packages/integrations/src/signer` |
| RPC failover | `packages/settlement/src/evm-rpc.ts` |
| Policy provenance | `policy_snapshot_hash`, evidence envelope |
| Failure injection CLI | `railguard inject`, `railguard race budget` |

## §15 MCP tools

| Plan name | MCP tool |
|-----------|----------|
| railguard_intent | `railguard_intent` / `railguard_create_intent` |
| railguard_simulate | `railguard_simulate` → authorize |
| railguard_authorize | `railguard_authorize` |
| railguard_execute | `railguard_execute` |
| railguard_status | `railguard_status` |
| railguard_verify | `railguard_verify` |
| railguard_receipt | `railguard_receipt` |

## §16 Adapters

| Partner | Package |
|---------|---------|
| MCP / AgentKit / OpenClaw | `packages/integrations/src/agents` |
| x402 / CDP / Base | existing kernel rails |
| viem | `packages/integrations/src/viem/guardedClient.ts` |
| Privy / Turnkey / Safe / ZeroDev | `packages/integrations/src/wallets` |
| Blockaid / Hypernative / GoPlus / CRE | `packages/integrations/src/risk` |
| Arbitrum / Monad / Arc / Celo | `packages/settlement/src/chains.ts` + settlement verify rails |
| Stellar / Airwallex | `packages/integrations/src/rails` |
| ZebPay pack | `apps/web/app/zebpay` |

## Evidence

- Base Sepolia: `bun run testnet-evidence`
- Arbitrum Sepolia: `bun run arbitrum-sepolia-evidence`

## Not in repo (process / external)

- FailSafe audit submission
- Grant form submissions
- Social CRM, job applications
- Hero video / Figma / brand renders
