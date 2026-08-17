/**
 * Render APF failure-lab terminal clips via Remotion (no ffmpeg drawtext / no VHS required).
 * Output: apps/video/capcut-pipeline/assets/terminal/{APF-003,APF-001,APF-004}.mp4
 *
 * Run: bun run video:terminal
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const APF_ROOT = join(ROOT, "..", "agent-payment-failure-lab")
const VIDEO_DIR = join(ROOT, "apps", "video")
const MANIFEST_PATH = join(ROOT, "apps", "video", "capcut-pipeline", "manifest.json")
const OUT_DIR = join(ROOT, "apps", "video", "capcut-pipeline", "assets", "terminal")
const VHS_DIR = join(ROOT, "apps", "video", "vhs")

const COMPOSITIONS: Record<string, string> = {
  "APF-003": "APF003",
  "APF-001": "APF001",
  "APF-004": "APF004",
}

interface LabRow {
  profile: string
  fixture: string
  result: string
  invariant: string
}

function runLab(profiles: string[]): LabRow[] {
  const code = `
    import { runLab } from "./packages/core/src/runner.ts";
    import { toJsonReport } from "./packages/core/src/reporters.ts";
    const evidence = runLab({ profiles: ${JSON.stringify(profiles)} });
    console.log(toJsonReport(evidence));
  `
  const result = spawnSync("bun", ["-e", code], {
    cwd: APF_ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  })
  if (result.status !== 0) throw new Error(result.stderr || "APF lab failed")
  return (JSON.parse(result.stdout) as { results: LabRow[] }).results
}

function terminalLines(profileId: string, rows: LabRow[]): string[] {
  const lines = [
    `$ npm run lab -- --profile ${profileId}`,
    "",
    "profile  fixture          result  invariant",
    "------------------------------------------------------------------------",
  ]
  for (const row of rows) {
    lines.push(
      `${row.profile.padEnd(8)} ${row.fixture.padEnd(16)} ${row.result.padEnd(6)}  ${row.invariant}`,
    )
  }
  lines.push("")
  const vuln = rows.find((r) => r.fixture.includes("vulnerable"))
  if (vuln) {
    lines.push(`// ${vuln.invariant}`)
    lines.push("vulnerable: guard released on unknown broadcast  [FAIL]")
    lines.push("fixed:      guard frozen until reconcile       [PASS]")
  }
  lines.push("")
  lines.push("github.com/prasanthkuna/agent-payment-failure-lab")
  return lines
}

function renderRemotion(profileId: string, lines: string[]) {
  const composition = COMPOSITIONS[profileId]
  if (!composition) throw new Error(`No composition for ${profileId}`)

  const propsPath = join(OUT_DIR, `${profileId}.props.json`)
  const outPath = join(OUT_DIR, `${profileId}.mp4`)
  writeFileSync(propsPath, JSON.stringify({ profileId, lines }, null, 2))

  const result = spawnSync(
    "bunx",
    [
      "remotion",
      "render",
      "src/index.ts",
      composition,
      outPath,
      `--props=${propsPath}`,
    ],
    { cwd: VIDEO_DIR, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    throw new Error(`Remotion render failed for ${profileId}:\n${result.stderr || result.stdout}`)
  }
  console.log(`  ${outPath}`)
}

function writeVhsTape(profileId: string, lines: string[]) {
  mkdirSync(VHS_DIR, { recursive: true })
  const tape = [
    `Output ${join(OUT_DIR, profileId).replace(/\\/g, "/")}.mp4`,
    "Set Width 1920",
    "Set Height 1080",
    "Set FontSize 26",
    "Set Theme \"Catppuccin Mocha\"",
    "Set Shell pwsh",
    "Hide",
    ...lines.slice(0, 10).flatMap((line) => [`Type ${JSON.stringify(line)}`, "Enter", "Sleep 300ms"]),
    "Sleep 2s",
  ].join("\n")
  writeFileSync(join(VHS_DIR, `${profileId}.tape`), tape)
}

function main() {
  if (!existsSync(APF_ROOT)) {
    console.error(`APF lab not found: ${APF_ROOT}`)
    process.exit(1)
  }

  const profiles = existsSync(MANIFEST_PATH)
    ? ((JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as { terminalProfiles?: string[] })
        .terminalProfiles ?? ["APF-003", "APF-001", "APF-004"])
    : ["APF-003", "APF-001", "APF-004"]

  mkdirSync(OUT_DIR, { recursive: true })

  for (const profileId of profiles) {
    console.log(`[terminal] ${profileId}`)
    const rows = runLab([profileId])
    const lines = terminalLines(profileId, rows)
    writeVhsTape(profileId, lines)
    renderRemotion(profileId, lines)
  }

  console.log(`\n[terminal] clips ready: ${OUT_DIR}`)
}

main()
