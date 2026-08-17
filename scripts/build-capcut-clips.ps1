# Ken Burns clips from manifest-driven PNGs (feeds CapCut drafts)
param(
    [string]$Root = 'C:\Users\PrashanthKuna\coinbase'
)
$ErrorActionPreference = 'Stop'

$Pipeline = Join-Path $Root 'apps\video\capcut-pipeline'
$ManifestPath = Join-Path $Pipeline 'manifest.json'
$PngDir = Join-Path $Pipeline 'assets\ui\screenshots'
$ClipDir = Join-Path $Pipeline 'assets\clips'
$WorkDir = Join-Path $Pipeline 'assets\clips\_work'

if (-not (Test-Path $ManifestPath)) {
    throw "Missing manifest. Run: bun run video:seed"
}

$manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $ClipDir, $WorkDir | Out-Null

$W = 3840
$H = 2160
$Fps = 60
$Bg = '0xEEF0F3'

function Get-MotionFilter {
    param([string]$Name)
    switch ($Name) {
        'zoom-in' { return "zoompan=z='if(lte(on,1),1.02,min(zoom+0.00045,1.14))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=$Fps" }
        'pan-right' { return "zoompan=z='1.08':x='if(lte(on,1),0,min(x+2.2,iw-iw/zoom))':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=$Fps" }
        'hero-tilt' { return "zoompan=z='if(lte(on,1),1.05,min(zoom+0.00025,1.18))':x='iw/2-(iw/zoom/2)+sin(on/40)*12':y='ih/2-(ih/zoom/2)+cos(on/55)*8':d=1:s=${W}x${H}:fps=$Fps" }
        'pull-back' { return "zoompan=z='if(lte(on,1),1.16,max(zoom-0.00055,1.02))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=$Fps" }
        'float' { return "zoompan=z='1.06+0.02*sin(on/30)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+sin(on/45)*10':d=1:s=${W}x${H}:fps=$Fps" }
        default { return "zoompan=z='if(lte(on,1),1.03,min(zoom+0.00035,1.12))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=$Fps" }
    }
}

function New-SceneClip {
    param(
        [string]$Id,
        [string]$InputPng,
        [double]$Seconds,
        [string]$Motion
    )
    $frames = [int]($Seconds * $Fps)
    $out = Join-Path $ClipDir "$Id.mp4"
    $filter = Get-MotionFilter -Name $Motion
    $vf = "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${Bg},${filter},format=yuv420p"
    & ffmpeg -y -hide_banner -loglevel error -loop 1 -i $InputPng `
        -vf $vf -frames:v $frames -r $Fps -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p $out
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed: $Id" }
    return $out
}

$clipManifest = @()
foreach ($scene in $manifest.scenes) {
    $png = Join-Path $PngDir "$($scene.id).png"
    if (-not (Test-Path $png)) { throw "Missing screenshot: $png (run video:capture)" }
    $clip = New-SceneClip -Id $scene.id -InputPng $png -Seconds $scene.clipSeconds -Motion $scene.motion
    $clipManifest += [pscustomobject]@{
        id = $scene.id
        clip = $clip
        seconds = $scene.clipSeconds
        caption = $scene.caption
    }
    Write-Host "Built clip $($scene.id) ($($scene.clipSeconds)s)"
}

# End card
$end = $manifest.endCard
$endCard = Join-Path $ClipDir '07-endcard.mp4'
$endSeconds = [double]$end.seconds
$endFilter = @"
scale=${W}:${H},drawbox=x=0:y=0:w=iw:h=ih:color=${Bg}:t=fill,
drawtext=fontfile=C\\:/Windows/Fonts/segoeuib.ttf:text='$($end.title)':fontsize=140:fontcolor=0x111111:x=(w-text_w)/2:y=(h/2)-220,
drawtext=fontfile=C\\:/Windows/Fonts/segoeui.ttf:text='$($end.url -replace 'https://','')':fontsize=52:fontcolor=0x0052FF:x=(w-text_w)/2:y=(h/2)-40,
drawtext=fontfile=C\\:/Windows/Fonts/segoeui.ttf:text='$($end.tagline)':fontsize=48:fontcolor=0x444444:x=(w-text_w)/2:y=(h/2)+50,
format=yuv420p
"@
& ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=${Bg}:s=${W}x${H}:d=$endSeconds:r=$Fps" `
    -vf $endFilter -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p $endCard
if ($LASTEXITCODE -ne 0) { throw 'ffmpeg failed: end card' }

$clipManifest += [pscustomobject]@{
    id = '07-endcard'
    clip = $endCard
    seconds = $endSeconds
    caption = $end.tagline
}

$clipsJson = @{
    generatedAt = (Get-Date).ToString('o')
    clips = $clipManifest
}
$clipsJson | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $ClipDir 'clips.json') -Encoding utf8
Write-Host "Ken Burns clips ready: $ClipDir"
