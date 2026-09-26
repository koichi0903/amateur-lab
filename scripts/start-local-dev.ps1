param(
    [ValidateSet("same-repo", "known-different", "unknown", "no-owner")]
    [string]$TestCase
)

$ErrorActionPreference = "Stop"

function Get-OwnerClassification {
    param(
        [int]$OwnerPid,
        [object]$Marker,
        [object]$ProcessInfo,
        [string]$RepoRoot
    )

    if ($OwnerPid -eq 0) { return "no-owner" }
    if ($null -eq $Marker -or $null -eq $ProcessInfo) { return "unknown" }

    $samePid = [int]$Marker.pid -eq $OwnerPid
    $sameRepo = [string]$Marker.repoRoot -eq $RepoRoot
    $isNext = [string]$ProcessInfo.CommandLine -match "(?i)(next|next\\dist\\bin)"

    if ($samePid -and $sameRepo -and $isNext) { return "same-repo" }
    if (-not $sameRepo -and [string]$Marker.repoRoot -match "(?i)(amateur-lab|bijyo)" -and $isNext) {
        return "known-different"
    }
    return "unknown"
}

if ($TestCase) {
    $fakeRoot = "C:\canonical\amateur-lab"
    $fakeProcess = [pscustomobject]@{ CommandLine = "next dev --webpack -p 3000" }
    $fakeMarker = switch ($TestCase) {
        "same-repo" { [pscustomobject]@{ pid = 1234; repoRoot = $fakeRoot } }
        "known-different" { [pscustomobject]@{ pid = 1234; repoRoot = "C:\old\amateur-lab" } }
        "unknown" { $null }
        "no-owner" { $null }
    }
    $ownerPid = if ($TestCase -eq "no-owner") { 0 } else { 1234 }
    [pscustomobject]@{ case = $TestCase; classification = Get-OwnerClassification $ownerPid $fakeMarker $fakeProcess $fakeRoot } | ConvertTo-Json -Compress
    exit 0
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$expectedRepoRoot = "C:\Users\DELL\Documents\Codex\amateur-lab-myfans-daily-funnel-audit"
if ($repoRoot -ne $expectedRepoRoot) {
    throw "Canonical local dev must be started from $expectedRepoRoot; refusing checkout $repoRoot"
}
$packagePath = Join-Path $repoRoot "package.json"
$envPath = Join-Path $repoRoot ".env.local"
$stateDir = Join-Path $env:LOCALAPPDATA "amateur-lab"

if (-not (Test-Path -LiteralPath $packagePath)) { throw "package.json was not found at $repoRoot" }
if (-not (Test-Path -LiteralPath $envPath)) {
    Write-Warning "No .env.local at $envPath. Values are never printed by this launcher; HTTP readiness will determine whether the app can run."
}

$head = (& git -c "safe.directory=$repoRoot" -C $repoRoot rev-parse HEAD 2>$null).Trim()
if (-not $head) { throw "Could not resolve the Git HEAD for $repoRoot" }

try {
    New-Item -ItemType Directory -Path $stateDir -Force -ErrorAction Stop | Out-Null
    $writeProbe = Join-Path $stateDir ".write-probe"
    Set-Content -LiteralPath $writeProbe -Value "ok" -Encoding utf8 -ErrorAction Stop
    Remove-Item -LiteralPath $writeProbe -Force -ErrorAction SilentlyContinue
}
catch {
    $stateDir = Join-Path $env:TEMP "amateur-lab"
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    Write-Warning "Could not write under LOCALAPPDATA; using TEMP for the non-secret PID/log marker."
}
$markerPath = Join-Path $stateDir "local-dev-3000.json"
$logPath = Join-Path $stateDir "local-dev-3000.log"
$errorLogPath = Join-Path $stateDir "local-dev-3000.err.log"

function Read-OwnerProcess {
    param([int]$ProcessId)
    try {
        return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    }
    catch {
        return $null
    }
}

function Get-PortOwner {
    $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) { return [int]$connection.OwningProcess }
    $netstatLines = netstat -ano -p tcp 2>$null | Select-String "LISTENING"
    foreach ($line in $netstatLines) {
        if ($line.Line -match "^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$") {
            return [int]$Matches[1]
        }
    }
    return 0
}

function Test-IsProcessTreeMember {
    param(
        [int]$ProcessId,
        [int]$RootProcessId
    )

    $currentId = $ProcessId
    $visited = @{}
    while ($currentId -and -not $visited.ContainsKey($currentId)) {
        if ($currentId -eq $RootProcessId) { return $true }
        $visited[$currentId] = $true
        try {
            $process = Get-CimInstance Win32_Process -Filter "ProcessId = $currentId" -ErrorAction Stop
        }
        catch {
            return $false
        }
        if ($null -eq $process) { return $false }
        $currentId = [int]$process.ParentProcessId
    }
    return $false
}

$ownerPid = Get-PortOwner
$portWasFree = $ownerPid -eq 0
$marker = $null
if (Test-Path -LiteralPath $markerPath) {
    try { $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json }
    catch { $marker = $null }
}
$processInfo = if ($ownerPid) { Read-OwnerProcess $ownerPid } else { $null }
$classification = Get-OwnerClassification $ownerPid $marker $processInfo $repoRoot

Write-Host "repoRoot: $repoRoot"
Write-Host "HEAD: $head"
Write-Host "port 3000 PID: $(if ($ownerPid) { $ownerPid } else { 'none' })"

switch ($classification) {
    "same-repo" {
        Write-Host "A canonical Next server is already running for this repo; refusing duplicate startup."
        Write-Host "server cwd: $($marker.repoRoot)"
        Write-Host "server command: $($processInfo.CommandLine)"
        exit 0
    }
    "known-different" {
        Write-Host "Port 3000 is owned by a different known amateur-lab checkout: $($marker.repoRoot). No process was stopped; stop it explicitly after verifying its provenance."
        exit 2
    }
    "unknown" {
        Write-Host "Port 3000 is owned by an unverified process (PID $ownerPid). No process was stopped. Inspect it before retrying."
        exit 2
    }
}

$nextCli = Join-Path $repoRoot "node_modules\next\dist\bin\next"
if (-not (Test-Path -LiteralPath $nextCli)) { throw "Next CLI was not found at $nextCli" }

$arguments = @($nextCli, "dev", "--webpack", "-H", "127.0.0.1", "-p", "3000")
$server = Start-Process -FilePath "node.exe" -ArgumentList $arguments -WorkingDirectory $repoRoot -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru
$markerData = [ordered]@{
    pid = $server.Id
    repoRoot = $repoRoot
    head = $head
    command = "node $nextCli dev --webpack -H 127.0.0.1 -p 3000"
    startedAt = (Get-Date).ToUniversalTime().ToString("o")
}
$markerData | ConvertTo-Json | Set-Content -LiteralPath $markerPath -Encoding utf8

try {
    $ready = $false
    for ($attempt = 1; $attempt -le 60; $attempt++) {
        if ($server.HasExited) { throw "Next exited before HTTP became ready. See $logPath and $errorLogPath" }
        $currentOwner = Get-PortOwner
        $ownedByLaunch = $currentOwner -eq $server.Id -or (Test-IsProcessTreeMember $currentOwner $server.Id)
        if ($ownedByLaunch -or ($portWasFree -and $currentOwner -ne 0)) {
            try {
                $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000/robots.txt" -UseBasicParsing -TimeoutSec 10
                if ($response.StatusCode -eq 200) { $ready = $true; break }
            }
            catch { }
        }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw "Next did not become ready on http://127.0.0.1:3000 within 60 seconds. See $logPath and $errorLogPath" }
    $listenerPid = Get-PortOwner
    $markerData.pid = $listenerPid
    $markerData | ConvertTo-Json | Set-Content -LiteralPath $markerPath -Encoding utf8
    Write-Host "port 3000 PID: $listenerPid"
    Write-Host "cwd: $repoRoot"
    Write-Host "HEAD: $head"
    Write-Host "HTTP: 200 /robots.txt"
    Write-Host "log: $logPath"
    Write-Host "error log: $errorLogPath"
}
catch {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
    if ($portWasFree) {
        $listenerAfterFailure = Get-PortOwner
        if ($listenerAfterFailure) { Stop-Process -Id $listenerAfterFailure -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -LiteralPath $markerPath -Force -ErrorAction SilentlyContinue
    throw
}
