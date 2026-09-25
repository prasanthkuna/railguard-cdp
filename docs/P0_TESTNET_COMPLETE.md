# P0 / testnet completion (no mainnet)

| Item | Status | Proof |
|------|--------|--------|
| Reorg rewind/rescan | Done | `packages/settlement/src/reorg.ts`, cron `apps/api/reorgRescan.ts`, anchor on reconcile |
| KMS/HSM/MPC signers | Done | `packages/integrations/src/signer` + `signer.test.ts` |
| Wallet vendors | Testnet-wired | `RAILGUARD_TESTNET_WALLET=1` + `TESTNET_WALLET_PRIVATE_KEY`; provider env for live keys |
| Risk vendors | Live HTTP | Blockaid/GoPlus fetch when keys set; GoPlus optional without key |
| Arc | Testnet only | `bun run arc-testnet-evidence` → `evidence/arc-testnet/` |
| CDP Base Sepolia | Smoke + live script | `bun run cdp-base-sepolia-smoke`; `bun run cdp-live-transfer-smoke` (needs USDC on CDP wallet) |
| Foundry E2E | Done | `bun run forge:test` (53 tests, `railguard-new/contracts`) |
| Stellar testnet | Done | `bun run stellar-testnet-evidence` → Horizon verify |

```powershell
bun run testnet:all
bun run stellar-testnet-evidence
bun run arc-testnet-evidence
bun run forge:test
$env:TESTNET_INTEGRATION="1"; bun test packages/settlement/src/stellar-testnet.test.ts
```
