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
# Node treats the mere presence of FORCE_COLOR as taking precedence over
# NO_COLOR, even when FORCE_COLOR is "0". Keep only one setting so a harmless
# startup warning cannot be promoted to a terminating PowerShell error.
Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
$env:FORCE_COLOR = "0"
$projectDir = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA "HakkutsuLAB\scheduled-update-logs"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $logDir "$timestamp-$Group.log"
$logFile = Split-Path -Leaf $logPath
$runId = [guid]::NewGuid().ToString()
$mutex = [System.Threading.Mutex]::new($false, "HakkutsuLAB-LocalUpdate")
$hasLock = $false

function Invoke-ScheduleMonitor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Status,
        [string]$Message = ""
    )

    $monitorArguments = @(
        "scripts\scheduled-update-monitor.mjs",
        "--run-id=$runId",
        "--group=$Group",
        "--status=$Status",
        "--log-file=$logFile"
    )
    if ($Message) {
        $monitorArguments += "--error=$Message"
    }

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & node.exe $monitorArguments 2>&1 | Tee-Object -FilePath $logPath -Append
        if ($LASTEXITCODE -ne 0) {
            "[$(Get-Date -Format o)] WARNING: Schedule monitor exited with code $LASTEXITCODE." |
                Tee-Object -FilePath $logPath -Append
        }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

try {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Set-Location -LiteralPath $projectDir
    $hasLock = $mutex.WaitOne(0)
    if (-not $hasLock) {
        "[$(Get-Date -Format o)] Another HakkutsuLAB update is already running. Skipped: $Group" |
            Tee-Object -FilePath $logPath
        Invoke-ScheduleMonitor -Status "skipped"
        exit 0
    }

    "[$(Get-Date -Format o)] Starting scheduled update: $Group" |
        Tee-Object -FilePath $logPath
    Invoke-ScheduleMonitor -Status "running"

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    # Windows PowerShell converts a native process's stderr lines into
    # ErrorRecord objects. With ErrorActionPreference=Stop, a warning written
    # to stderr used to terminate the task before the updater started. Capture
    # all output, then determine success only from Node's exit code.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $updateOutput = @(
            & $node "scripts\local-admin-update.mjs" $Group 2>&1 |
                ForEach-Object { $_.ToString() } |
                Tee-Object -FilePath $logPath -Append
        )
        $nodeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($nodeExitCode -ne 0) {
        $failureDetail = $updateOutput |
            Where-Object { $_ -match '\[工程失敗\]' } |
            Select-Object -Last 1
        if ($failureDetail) {
            throw $failureDetail
        }
        throw "Scheduled update failed with exit code $nodeExitCode."
    }

    "[$(Get-Date -Format o)] Completed scheduled update: $Group" |
        Tee-Object -FilePath $logPath -Append
    Invoke-ScheduleMonitor -Status "completed"
}
catch {
    $failureMessage = $_.Exception.Message
    "[$(Get-Date -Format o)] ERROR: $failureMessage" |
        Tee-Object -FilePath $logPath -Append
    try {
        Set-Location -LiteralPath $projectDir
        Invoke-ScheduleMonitor -Status "failed" -Message $failureMessage
    }
    catch {
        "[$(Get-Date -Format o)] WARNING: Failed to record schedule error: $($_.Exception.Message)" |
            Tee-Object -FilePath $logPath -Append
    }
    exit 1
}
finally {
    if ($hasLock) {
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
