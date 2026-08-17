# Execution Rails (v5)

Adapters implement `ExecutionRail` from `@railguard/kernel`.

## Supported now

| Rail | Package | Notes |
|------|---------|-------|
| **x402** | `packages/kernel/src/adapters/x402Rail.ts` | HTTP 402 policy + settlement |
| **cdp** | `packages/kernel/src/adapters/cdpRail.ts` | Coinbase CDP transfers |
| **base** | CDP demo path | Base Sepolia via CDP |

## Deferred (grant phase)

- `arc`, `solana`, `stellar`, `stripe`
- `mandates/ap2` — normalize mandates → `FinancialIntent`

## Registry

```typescript
import { createDefaultRailRegistry, createCdpExecutionRail, createX402ExecutionRail } from "@railguard/kernel"

const registry = createDefaultRailRegistry()
registry.register(createX402ExecutionRail())
registry.register(createCdpExecutionRail({ organizationId: "org_1", payerAddress: "0x..." }))
```
