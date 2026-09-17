#!/usr/bin/env bash
set -eu
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.4"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi
cd "$(dirname "$0")/.."
bun install
bun install --frozen-lockfile
