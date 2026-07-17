param(
  [ValidateSet("production", "development")]
  [string]$Environment = "development",
  [string]$ConvexSiteUrl
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repositoryRoot "web"
Push-Location $webRoot
try {
  $convex = @(
    (Join-Path $webRoot "node_modules\.bin\convex.cmd"),
    (Join-Path $repositoryRoot "node_modules\.bin\convex.cmd")
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $convex) {
    throw "Convex CLI was not found. Run npm install from $repositoryRoot first."
  }
  $secret = if ($Environment -eq "production") {
    (& $convex env get --prod RULES_PLEASE_WORKER_SECRET).Trim()
  } else {
    (& $convex env get RULES_PLEASE_WORKER_SECRET).Trim()
  }
} finally {
  Pop-Location
}

if (-not $secret) {
  throw "RULES_PLEASE_WORKER_SECRET is not configured for the $Environment Convex deployment."
}

if (-not $ConvexSiteUrl) {
  $ConvexSiteUrl = if ($Environment -eq "production") {
    "https://dependable-fennec-742.convex.site"
  } else {
    "https://tidy-heron-277.convex.site"
  }
}

$env:CONVEX_SITE_URL = $ConvexSiteUrl
$env:RULES_PLEASE_WORKER_SECRET = $secret
$env:RULES_PLEASE_UPLOAD_PDFS = "1"

Write-Host "Starting Rules Please worker against $Environment ($ConvexSiteUrl)"

& "C:\Python313\python.exe" (Join-Path $repositoryRoot "convex_worker.py")
