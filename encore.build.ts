import type { BuildConfig } from "encore.dev/config"

/** Keep Remotion video app out of Encore's TypeScript graph (separate workspace). */
export const build: BuildConfig = {
  exclude: ["apps/video/**", "examples/**"],
}
