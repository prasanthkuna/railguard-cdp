# CapCut social cuts from Remotion exports + APF terminal clips
param(
    [string]$Root = 'C:\Users\PrashanthKuna\coinbase',
    [switch]$SkipRender
)
$ErrorActionPreference = 'Stop'

$Pipeline = Join-Path $Root 'apps\video\capcut-pipeline'
$DraftsDir = Join-Path $Pipeline 'drafts'
$OutDir = Join-Path $Pipeline 'out'
$TerminalDir = Join-Path $Pipeline 'assets\terminal'
$RemotionOut = Join-Path $Root 'apps\video\out'
$ManifestPath = Join-Path $Pipeline 'manifest.json'

$master = Join-Path $RemotionOut 'railguard-demo-master.mp4'
$social = Join-Path $RemotionOut 'railguard-demo-social.mp4'
$apf003 = Join-Path $TerminalDir 'APF-003.mp4'

foreach ($f in @($master, $social, $apf003)) {
    if (-not (Test-Path $f)) { throw "Missing $f - run render-pro-pipeline.ps1 first" }
}

if (-not (Get-Command capcut -ErrorAction SilentlyContinue)) {
    throw 'capcut-cli not found. Run: npm install -g capcut-cli'
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $DraftsDir, $OutDir | Out-Null

function New-Draft {
    param([string]$Name)
    $path = Join-Path $DraftsDir $Name
    if (Test-Path $path) { Remove-Item -Recurse -Force $path }
    capcut init $Name --drafts $DraftsDir | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "capcut init failed: $Name" }
    return $path
}

# APF-003 social (terminal + hook)
Write-Host 'CapCut: APF-003 Frozen Guard...'
$apfDraft = New-Draft 'APF-003 Frozen Guard'
capcut add-video $apfDraft $apf003 0s 12s -q
capcut add-text $apfDraft 0s 3s 'Crash after broadcast?' --font-size 26 --color '#FFD700' --align 1 --y -0.42 -q
capcut add-text $apfDraft 9s 3s 'agent-payment-failure-lab' --font-size 18 --color '#8b949e' --align 1 --y 0.42 -q

# Product social (Remotion social + end card text)
Write-Host 'CapCut: Railguard Social Polish...'
$socialDraft = New-Draft 'Railguard Social Polish'
capcut add-video $socialDraft $social 0s 55s -q
capcut add-text $socialDraft 0s 4s 'Payment stopped before USDC moved.' --font-size 24 --color '#FFFFFF' --align 1 --y -0.38 -q
capcut add-text $socialDraft 48s 5s $manifest.endCard.url --font-size 20 --color '#0052FF' --align 1 --y 0.4 -q

if (-not $SkipRender) {
    Write-Host 'CapCut render (ffmpeg proxy)...'
    capcut render $apfDraft --out (Join-Path $OutDir 'apf-003-social-capcut.mp4') --burn-captions --scale 0.75
    capcut render $socialDraft --out (Join-Path $OutDir 'railguard-social-capcut.mp4') --burn-captions --scale 0.75

    Copy-Item $master (Join-Path $OutDir 'railguard-demo-master.mp4') -Force
    Copy-Item $social (Join-Path $OutDir 'railguard-demo-social.mp4') -Force
    Copy-Item $apf003 (Join-Path $OutDir 'apf-003-terminal-raw.mp4') -Force
}

@{
    generatedAt = (Get-Date).ToString('o')
    remotion = @{ master = $master; social = $social }
    capcut = @{
        apf003Draft = $apfDraft
        socialDraft = $socialDraft
    }
    outputs = Get-ChildItem $OutDir -Filter *.mp4 | ForEach-Object { $_.FullName }
} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Pipeline 'build-index.json') -Encoding utf8

Write-Host "CapCut drafts: $DraftsDir"
Get-ChildItem $OutDir -Filter *.mp4 | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}}
