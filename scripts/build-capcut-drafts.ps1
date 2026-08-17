# Build CapCut drafts from Ken Burns + terminal clips, then ffmpeg proxy render.
param(
    [string]$Root = 'C:\Users\PrashanthKuna\coinbase',
    [switch]$SkipRender,
    [switch]$OpenInCapCut
)
$ErrorActionPreference = 'Stop'

$Pipeline = Join-Path $Root 'apps\video\capcut-pipeline'
$DraftsDir = Join-Path $Pipeline 'drafts'
$ClipDir = Join-Path $Pipeline 'assets\clips'
$TerminalDir = Join-Path $Pipeline 'assets\terminal'
$OutDir = Join-Path $Pipeline 'out'
$ClipsJson = Join-Path $ClipDir 'clips.json'
$ManifestPath = Join-Path $Pipeline 'manifest.json'

if (-not (Test-Path $ClipsJson)) {
    throw "Missing clips.json. Run: powershell -File scripts/build-capcut-clips.ps1"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$clips = (Get-Content $ClipsJson -Raw | ConvertFrom-Json).clips
New-Item -ItemType Directory -Force -Path $DraftsDir, $OutDir | Out-Null

function Assert-Capcut {
    $cmd = Get-Command capcut -ErrorAction SilentlyContinue
    if (-not $cmd) { throw 'capcut-cli not found. Run: npm install -g capcut-cli' }
}

function New-ProductDraft {
    param([string]$Name)
    $draftPath = Join-Path $DraftsDir $Name
    if (Test-Path $draftPath) { Remove-Item -Recurse -Force $draftPath }
    capcut init $Name --drafts $DraftsDir | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "capcut init failed: $Name" }

    $cursor = 0.0
    foreach ($item in $clips) {
        $start = "{0}s" -f $cursor
        $dur = "{0}s" -f $item.seconds
        capcut add-video $draftPath $item.clip $start $dur -q
        if ($LASTEXITCODE -ne 0) { throw "add-video failed: $($item.id)" }

        $caption = [string]$item.caption
        if ($caption) {
            capcut add-text $draftPath $start $dur $caption --font-size 22 --color "#FFFFFF" --align 1 --y -0.38 -q
        }
        $cursor += [double]$item.seconds
    }

    return $draftPath
}

function New-TerminalDraft {
    param(
        [string]$Name,
        [string]$ClipPath,
        [string]$Hook,
        [double]$Seconds
    )
    $draftPath = Join-Path $DraftsDir $Name
    if (Test-Path $draftPath) { Remove-Item -Recurse -Force $draftPath }
    capcut init $Name --drafts $DraftsDir | Out-Null
    capcut add-video $draftPath $ClipPath 0s ("{0}s" -f $Seconds) -q
    capcut add-text $draftPath 0s 3s $Hook --font-size 26 --color "#FFD700" --align 1 --y -0.42 -q
    capcut add-text $draftPath ("{0}s" -f ($Seconds - 3)) 3s "github.com/prasanthkuna/agent-payment-failure-lab" --font-size 18 --color "#8b949e" --align 1 --y 0.42 -q
    return $draftPath
}

function Render-Draft {
    param(
        [string]$DraftPath,
        [string]$OutFile,
        [double]$Scale = 0.75
    )
    capcut render $DraftPath --out $OutFile --burn-captions --scale $Scale --all-video-tracks
    if ($LASTEXITCODE -ne 0) { throw "capcut render failed: $OutFile" }
}

Assert-Capcut

Write-Host 'Building product master draft...'
$productDraft = New-ProductDraft -Name 'Railguard Product Master'
capcut lint $productDraft | Out-Null

Write-Host 'Building APF-003 social draft...'
$apfClip = Join-Path $TerminalDir 'APF-003.mp4'
if (-not (Test-Path $apfClip)) { throw "Missing $apfClip (run video:capture-terminal)" }
$apfDraft = New-TerminalDraft -Name 'APF-003 Frozen Guard' -ClipPath $apfClip -Hook 'Crash after broadcast?' -Seconds 12

if (-not $SkipRender) {
    Write-Host 'Rendering proxy MP4s (ffmpeg via capcut render)...'
    Render-Draft -DraftPath $productDraft -OutFile (Join-Path $OutDir 'railguard-product-master.mp4') -Scale 0.5
    Render-Draft -DraftPath $apfDraft -OutFile (Join-Path $OutDir 'apf-003-social.mp4') -Scale 0.75

    # Social cut: blocked + audit + end card stitched with ffmpeg
    $socialList = Join-Path $OutDir 'social-concat.txt'
    @(
        "file '$((Join-Path $ClipDir '03-blocked-hero.mp4') -replace '\\','/')'"
        "file '$((Join-Path $ClipDir '06-audit.mp4') -replace '\\','/')'"
        "file '$((Join-Path $ClipDir '07-endcard.mp4') -replace '\\','/')'"
    ) | Set-Content -Path $socialList -Encoding ascii
    $socialOut = Join-Path $OutDir 'railguard-social-cut.mp4'
    & ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i $socialList -c copy $socialOut
    if ($LASTEXITCODE -ne 0) { throw 'social concat failed' }
}

$index = @{
    generatedAt = (Get-Date).ToString('o')
    webUrl = $manifest.webUrl
    drafts = @{
        productMaster = $productDraft
        apf003 = $apfDraft
    }
    outputs = @{
        productMaster = (Join-Path $OutDir 'railguard-product-master.mp4')
        apf003 = (Join-Path $OutDir 'apf-003-social.mp4')
        socialCut = (Join-Path $OutDir 'railguard-social-cut.mp4')
    }
    capcutExport = 'Optional: open drafts in CapCut desktop, then run capcut export --batch --app capcut <draftsDir> for final 4K'
}
$index | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $Pipeline 'build-index.json') -Encoding utf8

Get-ChildItem $OutDir -Filter *.mp4 -ErrorAction SilentlyContinue | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}}, LastWriteTime
Write-Host "`nCapCut drafts: $DraftsDir"
Write-Host "Open CapCut → import drafts from drafts folder for final polish + 4K export."

if ($OpenInCapCut) {
    $capcutExe = "${env:LOCALAPPDATA}\CapCut\Apps\CapCut.exe"
    if (Test-Path $capcutExe) { Start-Process $capcutExe } else { Write-Warning 'CapCut desktop not found at default path.' }
}
