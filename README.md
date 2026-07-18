# Railguard CDP

[![tests](https://img.shields.io/badge/API%20tests-bun%20passing-green)](./apps/api/payment-state.test.ts)
[![evidence](https://img.shields.io/badge/evidence-Base%20Sepolia%20live-blue)](https://github.com/prasanthkuna/railguard-new/tree/master/evidence/cdp-base-sepolia)
[![status](https://img.shields.io/badge/status-reference%20implementation-lightgrey)](https://github.com/prasanthkuna/railguard-new/blob/master/docs/RELEASE_v0.1-reference.md)

**Enterprise execution and reconciliation** — invoice-to-USDC on Base Sepolia via Coinbase CDP.

> **Portfolio:** [railguard-new/evidence](https://github.com/prasanthkuna/railguard-new/tree/master/evidence) — public proof index.

## Four-layer stack

```text
Agent Payment Failure Lab   → adversarial profiles (APF-003, APF-004, APF-005)
x402-guard                  → pre-payment authorization and budget reservation
railguard-new               → on-chain session enforcement (SignGate + hook)
railguard-cdp (this repo)   → CDP execution, settlement verification, reconciliation
```

## What this repo proves

| Capability | Status |
|------------|--------|
| Invoice → policy → approval → payment intent | Shipped |
| x402 budget reservation (optional) | `X402_GUARD_ENABLED=true` |
| CDP wallet execution (Base Sepolia USDC) | `PAYMENT_MODE=live` |
| **Frozen authorization after broadcast** | INV-001 — [docs](./docs/INVARIANTS.md) |
| Settlement-fact verification (chain, token, sender, recipient, amount) | INV-002 |
| Crash/restart reconciliation | INV-004, INV-005 |
| Durable guard correlation fields | Migration `008` |

## Payment modes

| Mode | `PAYMENT_MODE` | Behavior |
|------|----------------|----------|
| **Demo** | `demo` | Hash-bound settlement simulation — no CDP keys, no chain spend |
| **Live testnet** | `live` | Real CDP wallet + Base Sepolia USDC — requires CDP credentials |
| **Production** | — | Not shipped — reference implementation only |

## Quick start

### Bash / Linux / macOS

```bash
git clone https://github.com/prasanthkuna/railguard-cdp.git
cd railguard-cdp
bun install
bun run dev:api
```

### Windows (PowerShell)

```powershell
git clone https://github.com/prasanthkuna/railguard-cdp.git
cd railguard-cdp
bun install
bun run dev:api
```

### x402-guard integration

```bash
# Clone x402-guard as sibling or junction
export X402_GUARD_ENABLED=true
bun run dev:api
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `PAYMENT_MODE` | `demo` or `live` (required before execute) |
| `X402_GUARD_ENABLED` | `true` to gate payments with x402-guard |
| `CDP_CONFIRMATION_DEPTH` | Chain confirmations before confirmed (default `1`) |
| `BASE_SEPOLIA_RPC_URL` | Optional RPC override for settlement verification |

## Lifecycle invariant (APF-003)

```text
No broadcast proof  → release authorization
Broadcast occurred  → freeze authorization
Confirmed           → commit authorization
Reverted            → release authorization
Mismatch/uncertain  → reconciliation required
```

Proof: [evidence/apf-003](https://github.com/prasanthkuna/railguard-new/tree/master/evidence/apf-003) · [POSTMORTEM](https://github.com/prasanthkuna/agent-payment-failure-lab/blob/main/docs/POSTMORTEM-APF-003.md)

## Tests

```bash
bun test apps/api packages
encore check
```

| Test file | Covers |
|-----------|--------|
| `payment-state.test.ts` | INV-001, INV-005 state transitions |
| `payment-lifecycle.test.ts` | APF-003, APF-004 adversarial scenarios |
| `reconcile.test.ts` | Reconciler settlement convergence |
| `execution-claim.test.ts` | INV-003 concurrent execution claim |
| `packages/settlement` | INV-002 transfer-fact verification |

## Live evidence (Base Sepolia)

```bash
BASE_SEPOLIA_TX_HASH=0x80cac8ed62ca6ef0797f1a6244ab52e13e6c39ea23f3a0fa58e2fa95623872dd \
  bun run scripts/testnet-evidence.ts
```

Public manifest: [evidence/cdp-base-sepolia](https://github.com/prasanthkuna/railguard-new/tree/master/evidence/cdp-base-sepolia)

## Documentation

- [INVARIANTS.md](./docs/INVARIANTS.md) — INV-001 through INV-008
- [STATE_MACHINE.md](./docs/STATE_MACHINE.md) — payment, guard, settlement axes

## Known limitations

- Reference implementation — not production-ready for mainnet funds
- Demo mode uses hash binding, not full on-chain transfer verification
- Single RPC endpoint — no reorg detection or multi-provider quorum
- Hosted demo requires WorkOS; dev-header auth must be disabled in production
- Smart-account routing (CDP → SignGate hook) is future work

## Sibling repos

| Repo | Role |
|------|------|
| [agent-payment-failure-lab](https://github.com/prasanthkuna/agent-payment-failure-lab) | Adversarial failure profiles |
| [x402-guard](https://github.com/prasanthkuna/x402-guard) | Pre-sign policy (`authorizePayment`) |
| [railguard-new](https://github.com/prasanthkuna/railguard-new) | On-chain hook + SignGate |

## License

Apache-2.0
