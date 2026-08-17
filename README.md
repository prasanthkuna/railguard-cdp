# Railguard (coinbase monorepo)

[![tests](https://img.shields.io/badge/API%20tests-bun%20passing-green)](./apps/api/payment-state.test.ts)
[![evidence](https://img.shields.io/badge/evidence-Base%20Sepolia%20live-blue)](https://github.com/prasanthkuna/railguard-new/tree/master/evidence/cdp-base-sepolia)

**Agent treasury control plane** — policy → authorize → execute → reconcile → evidence.

Operator UI ships as **PreBroadcast** on Vercel. Backend: Encore API + CDP on Base Sepolia.

> **Live demo:** [prebroadcast.vercel.app](https://prebroadcast.vercel.app) · API: `https://staging-railguard-s4ii.encr.app`  
> **Constitution:** [v5plan.md](https://github.com/prasanthkuna/railguard-new/blob/master/docs/v5plan.md) · **Status:** [v5execution.md](https://github.com/prasanthkuna/railguard-new/blob/master/docs/v5execution.md)

## Stack (v5)

```text
Agent Payment Failure Lab   → conformance + adversarial profiles
@railguard/kernel           → FinancialIntent, Authority, Execution, Evidence
x402-guard (adapter)        → pre-payment budget + policy
coinbase/ (this repo)       → hosted API, console, CDP execution, reconciliation
railguard-new/signgate/     → optional on-chain high-assurance mode (Authority Engine Go)
```

## Quick start (Windows)

```powershell
git clone https://github.com/prasanthkuna/railguard-cdp.git coinbase
cd coinbase
bun install
bun run dev:api    # terminal 1 — Encore on :4000
bun run dev:web    # terminal 2 — console on :3000
```

> GitHub repo name is still `railguard-cdp`; local folder is often `coinbase/`. See [docs/MONOREPO.md](./docs/MONOREPO.md).

## Agent integration

| Surface | Command |
|---------|---------|
| CLI | `bun run railguard doctor` · `bun run railguard verify` |
| MCP | `bun run railguard:mcp` — [docs/INTEGRATION.md](./docs/INTEGRATION.md) |
| SDK | `@railguard/sdk` — `authorize()`, `execute()`, `verify()` |

## Payment modes

| Mode | `PAYMENT_MODE` | Behavior |
|------|----------------|----------|
| **Demo** | `demo` | Hash-bound settlement simulation |
| **Live testnet** | `live` | Real CDP + Base Sepolia USDC |

## Configuration

| Variable | Purpose |
|----------|---------|
| `PAYMENT_MODE` | `demo` or `live` |
| `X402_GUARD_ENABLED` | `true` for x402 Authority path |
| `RAILGUARD_ACCESS_TOKEN` | CLI / MCP / SDK auth |
| `RAILGUARD_BASE_URL` | API base (default `http://localhost:4000`) |

## Tests

```powershell
bun run test:v5
encore check
bun run verify:demo   # requires dev:api running
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [INTEGRATION.md](./docs/INTEGRATION.md) | CLI, MCP, SDK |
| [MONOREPO.md](./docs/MONOREPO.md) | Repo layout |
| [OSS_CLOUD.md](./docs/OSS_CLOUD.md) | Open source vs Cloud |
| [INVARIANTS.md](./docs/INVARIANTS.md) | INV-001..008 |
| [api/endpoints.md](./docs/api/endpoints.md) | REST surface |

## Sibling repos

| Repo | Role |
|------|------|
| [railguard-new](https://github.com/prasanthkuna/railguard-new) | Protocol, evidence, v5 plans, optional Authority Engine (Go) |
| [x402-guard](https://github.com/prasanthkuna/x402-guard) | x402 ExecutionRail adapter |
| [agent-payment-failure-lab](https://github.com/prasanthkuna/agent-payment-failure-lab) | Failure / conformance suite |
| [grant-ops](https://github.com/prasanthkuna/grant-ops) | Grant applications (private ops) |

## License

Apache-2.0
