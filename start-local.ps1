$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = "C:\Users\kdeme\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

$port = 4173
while ($true) {
  $busy = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if (-not $busy) {
    break
  }
  $port += 1
}

$env:PORT = "$port"
$url = "http://localhost:$port/"

Write-Host "Board Game Rules Wizard local MVP"
Write-Host "Serving: $root"
Write-Host "URL: $url"
Write-Host ""
Write-Host "Press Ctrl+C to stop."

& $python "app_server.py"
