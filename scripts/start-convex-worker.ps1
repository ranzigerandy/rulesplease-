param(
  [string]$ConvexSiteUrl = "https://tidy-heron-277.convex.site"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repositoryRoot "web"
Push-Location $webRoot
try {
  $convex = Join-Path $webRoot "node_modules\.bin\convex.cmd"
  $secret = (& $convex env get RULES_PLEASE_WORKER_SECRET).Trim()
} finally {
  Pop-Location
}

if (-not $secret) {
  throw "RULES_PLEASE_WORKER_SECRET is not configured for this Convex deployment."
}

$env:CONVEX_SITE_URL = $ConvexSiteUrl
$env:RULES_PLEASE_WORKER_SECRET = $secret
$env:RULES_PLEASE_UPLOAD_PDFS = "1"

& "C:\Python313\python.exe" (Join-Path $repositoryRoot "convex_worker.py")
