# EVM contracts — optional high-assurance mode (v5 §8)

On-chain enforcement via ERC-7579 hooks is **optional**. Default Railguard path is software authority + evidence.

## Source

Solidity contracts live in the sibling repo:

`railguard-new/signgate/contracts/` (RailguardExecutionHook, SessionValidator, AccountAdapter)

## When to enable

- Enterprise treasury
- Large agent budgets
- Institutional transactions
- High-risk agents

## Integration

Set `HIGH_ASSURANCE_MODE=true` and configure hook address in workspace settings (future). v5 API and kernel work without on-chain deployment.
