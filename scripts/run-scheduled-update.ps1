param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("daily-0030", "daily-1030", "tue-fri-1800", "sunday-1800")]
    [string]$Group
)

$ErrorActionPreference = "Stop"
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$env:NO_COLOR = "1"
$env:FORCE_COLOR = "0"
$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA "HakkutsuLAB\scheduled-update-logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logDir "$timestamp-$Group.log"
$mutex = [System.Threading.Mutex]::new($false, "HakkutsuLAB-LocalUpdate")
$hasLock = $false

try {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $hasLock = $mutex.WaitOne(0)
    if (-not $hasLock) {
        "[$(Get-Date -Format o)] Another HakkutsuLAB update is already running. Skipped: $Group" |
            Tee-Object -FilePath $logPath
        exit 0
    }

    Set-Location -LiteralPath $projectDir
    "[$(Get-Date -Format o)] Starting scheduled update: $Group" |
        Tee-Object -FilePath $logPath

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node "scripts\local-admin-update.mjs" $Group 2>&1 |
        Tee-Object -FilePath $logPath -Append

    if ($LASTEXITCODE -ne 0) {
        throw "Scheduled update failed with exit code $LASTEXITCODE."
    }

    "[$(Get-Date -Format o)] Completed scheduled update: $Group" |
        Tee-Object -FilePath $logPath -Append
}
catch {
    "[$(Get-Date -Format o)] ERROR: $($_.Exception.Message)" |
        Tee-Object -FilePath $logPath -Append
    exit 1
}
finally {
    if ($hasLock) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
