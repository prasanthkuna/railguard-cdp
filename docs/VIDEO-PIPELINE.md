# Railguard Pro Video Pipeline (2026)

Three lanes — no Rotato, no broken Playwright launch.

| Lane | Tool | Output |
|------|------|--------|
| **A — Failure Lab (70%)** | APF lab + ffmpeg terminal cards (+ optional VHS) | `capcut-pipeline/assets/terminal/APF-*.mp4` |
| **B — Product UI (30%)** | Remotion (code-as-video) | `apps/video/out/railguard-demo-*.mp4` |
| **C — Social polish** | CapCut CLI hooks + captions | `capcut-pipeline/out/*-capcut.mp4` |

## One command

```powershell
cd C:\Users\PrashanthKuna\coinbase
bun run video:pipeline
```

## Steps

```powershell
bun run video:seed      # staging verify → manifest.json
bun run video:sync      # manifest → Remotion constants.ts
bun run video:capture   # Edge CDP screenshots → public/assets/
bun run video:terminal  # APF-003/001/004 ffmpeg clips
bun run render:video    # Remotion master 2:30
bun run render:social   # Remotion social 0:55
bun run video:capcut    # CapCut drafts + proxy render
```

## Deliverables

```
apps/video/out/
  railguard-demo-master.mp4     # hiring / grants / landing
  railguard-demo-social.mp4     # LinkedIn / X cut

apps/video/capcut-pipeline/out/
  railguard-demo-master.mp4     # copy of Remotion master
  railguard-demo-social.mp4     # copy of Remotion social
  apf-003-terminal-raw.mp4      # failure-lab terminal
  apf-003-social-capcut.mp4     # hook + captions
  railguard-social-capcut.mp4   # polished social

apps/video/capcut-pipeline/drafts/   # open in CapCut for 4K export
apps/video/vhs/*.tape                # optional: vhs APF-003.tape
```

## Capture (Windows)

Playwright `launch()` and `connectOverCDP()` fail on some Windows hosts. This pipeline uses **puppeteer-core + Edge** instead.

```powershell
bun run video:capture   # puppeteer-core screenshots
```

Re-seed before capture if invoice pages show stale data:

```powershell
bun run video:seed && bun run video:capture
```

## Partial runs

```powershell
bun run video:pipeline -SkipSeed
bun run video:pipeline -SkipCapture    # reuse existing PNGs
bun run video:pipeline -SkipRemotion   # terminal + capcut only
bun run video:pipeline -SkipCapcut
```

## Optional VHS upgrade

Install [VHS](https://github.com/charmbracelet/vhs) for pixel-perfect terminal tapes:

```powershell
winget install charmbracelet.vhs
vhs apps\video\vhs\APF-003.tape
```

ffmpeg fallback in `video:terminal` works without VHS.

## Content strategy

- **70%** APF terminal clips — failure-first, hiring signal
- **30%** Remotion product walkthrough — policy + audit story
- CapCut = hooks, captions, music beds only
