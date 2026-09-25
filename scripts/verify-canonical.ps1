$ErrorActionPreference = "Stop"

$expectedRoot = "C:\Users\DELL\Documents\Codex\amateur-lab-myfans-daily-funnel-audit"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ($repoRoot -ne $expectedRoot) { throw "Canonical path mismatch: $repoRoot" }

$head = (& git -c "safe.directory=$repoRoot" -C $repoRoot rev-parse HEAD 2>$null).Trim()
$originHead = (& git -c "safe.directory=$repoRoot" -C $repoRoot rev-parse origin/main 2>$null).Trim()
if (-not $head -or $head -ne $originHead) { throw "HEAD does not match origin/main" }
if ((& git -c "safe.directory=$repoRoot" -C $repoRoot status --porcelain) -ne $null) { throw "Canonical worktree is not clean" }

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) { throw "No listener on port 3000" }
$ownerPid = [int]$listener.OwningProcess
$markerPath = Join-Path $env:LOCALAPPDATA "amateur-lab\local-dev-3000.json"
if (-not (Test-Path -LiteralPath $markerPath)) { throw "Canonical server marker not found" }
$marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
if ([string]$marker.repoRoot -ne $repoRoot) { throw "Port 3000 marker is not canonical" }
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerPid" -ErrorAction SilentlyContinue
if (-not $process -or [string]$process.CommandLine -notmatch "(?i)(next|next\\dist\\bin)") { throw "Port 3000 is not owned by a Next process" }

$routes = @(
  "http://127.0.0.1:3000/admin",
  "http://127.0.0.1:3000/admin/x-growth",
  "http://127.0.0.1:3000/admin/myfans?media=1",
  "http://127.0.0.1:3000/admin/myfans/x-growth",
  "http://127.0.0.1:3000/admin/bijyo-reserved"
)
foreach ($url in $routes) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) { throw "HTTP $($response.StatusCode)" }
  }
  catch {
    $webResponse = $_.Exception.Response
    if (-not $webResponse -or [int]$webResponse.StatusCode -lt 300 -or [int]$webResponse.StatusCode -ge 400) { throw "Route check failed: $url" }
  }
}

[pscustomobject]@{ ready = $true; repoRoot = $repoRoot; head = $head; originMain = $originHead; port3000Pid = $ownerPid; routes = $routes } | ConvertTo-Json -Compress
