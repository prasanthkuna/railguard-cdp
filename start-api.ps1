# start-api.ps1 — starts Encore with ~encore shim fix for Windows
$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

# Refresh PATH so fnm is available
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Activate fnm and switch to Node 20
fnm env --use-on-cd | Out-String | Invoke-Expression
fnm use 20
Write-Host "Node: $(node --version)"

# Clean stale build
Remove-Item -Recurse -Force "$repoRoot\.encore\build" -ErrorAction SilentlyContinue

# Run encore build first (not run) to generate the build output
Write-Host "Building Encore application..."
$buildProc = Start-Process -FilePath "encore" -ArgumentList "run" -WorkingDirectory $repoRoot -PassThru -NoNewWindow

# Wait for the build output to appear
$maxAttempts = 60
for ($i = 0; $i -lt $maxAttempts; $i++) {
    $mainMjs = "$repoRoot\.encore\build\combined\combined\main.mjs"
    if (Test-Path $mainMjs) {
        Start-Sleep -Milliseconds 200
        
        # Create ~encore shim
        $shimDir = "$repoRoot\.encore\build\combined\combined\node_modules\~encore"
        New-Item -ItemType Directory -Force -Path "$shimDir\auth" | Out-Null

        '{"name":"~encore","version":"1.0.0","type":"module","exports":{"./auth":"./auth/index.js"}}' |
            Set-Content "$shimDir\package.json" -Encoding UTF8

        'import { getAuthData as _getAuthData } from "encore.dev/internal/codegen/auth";' + "`n" +
        'export function getAuthData() { return _getAuthData(); }' |
            Set-Content "$shimDir\auth\index.js" -Encoding UTF8

        Write-Host "~encore shim injected successfully"
        break
    }
    Start-Sleep -Milliseconds 500
}

# Let encore run continue (it's already running)
Write-Host "Encore is running. Press Ctrl+C to stop."
$buildProc.WaitForExit()
