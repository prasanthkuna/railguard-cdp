# Dependency audit (Railguard monorepo)

## Status

Deployable workspaces (`apps/api`, `apps/web`, `packages/*`) are lint-clean and unit-tested. Full monorepo `bun audit` may include legacy `apps/video` and stale lockfile references from removed workspaces.

## Recommended CI/local commands

```powershell
cd coinbase
bun run lint
bun test apps/api packages
encore check
```

For audit on deploy paths only (after lockfile regen):

```powershell
$env:BUN_INSTALL_CACHE_DIR = "$env:TEMP\bun-cache"
bun install
bun audit --filter @railguard/api
```

## Known approach

1. Keep `apps/video` and `scripts/` in `biome.json` ignore (non-deploy).
2. Regenerate lockfile when vitest cache EPERM is resolved (use temp `BUN_INSTALL_CACHE_DIR` on Windows).
3. Upgrade Next.js / Remotion only when video workspace is reintroduced or removed from lockfile.

Do not block portfolio demos on video-workspace advisories.
