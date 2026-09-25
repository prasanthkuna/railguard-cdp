# viem guarded settlement verify

```powershell
cd coinbase
bun run arbitrum-sepolia-evidence
# or
$env:BASE_SEPOLIA_TX_HASH="0x..."
bun run testnet-evidence
```

Uses `packages/integrations/src/viem/guardedClient.ts` and `packages/settlement`.
