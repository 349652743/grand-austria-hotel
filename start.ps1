param([int]$Port = 3210, [switch]$Foreground, [string]$DataDir = '')
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$runtime = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $runtime) { throw 'Node.js 24 or newer is required.' }
if ($DataDir) { $env:GAH_DATA_DIR = [IO.Path]::GetFullPath($DataDir) }
$paths = (& $runtime (Join-Path $projectDir 'paths.mjs') $Port) | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Unable to resolve runtime paths.' }
$stateDir = $paths.dataDir
$cacheDir = $paths.cacheDir
$existing = $null
try { $existing = Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 } catch {}
if ($existing.service -eq 'grand-austria-hotel') {
    Write-Output "Already running: http://localhost:$Port"
} else {
    New-Item -ItemType Directory -Force -Path $stateDir, $cacheDir | Out-Null
    $env:PORT = "$Port"
    $env:HOST = '0.0.0.0'
    $env:GAH_DATA_DIR = $stateDir
    $env:TEMP = $cacheDir
    $env:TMP = $cacheDir
    if ($Foreground) {
        Push-Location $projectDir
        try { & $runtime 'server.mjs' } finally { Pop-Location }
        exit
    }
    $serverProcess = Start-Process -FilePath $runtime -ArgumentList 'server.mjs' -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'server.log') -RedirectStandardError (Join-Path $stateDir 'server-error.log') -PassThru
    $serverProcess.Id | Set-Content -LiteralPath (Join-Path $stateDir 'server.pid')
    $healthy = $false
    for ($attempt=0; $attempt -lt 20; $attempt++) {
        try { $status = Invoke-RestMethod "http://127.0.0.1:$Port/api/health" -TimeoutSec 1; if ($status.service -eq 'grand-austria-hotel') { $healthy = $true; break } } catch {}
        Start-Sleep -Milliseconds 150
    }
    if (-not $healthy) { throw "Startup failed. See $stateDir\server-error.log" }
    Write-Output "Started: http://localhost:$Port"
}
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match '^192\.168\.|^10\.' -and $_.AddressState -eq 'Preferred' } |
    ForEach-Object { Write-Output "LAN: http://$($_.IPAddress):$Port" }
