$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run-scheduled-update.ps1"
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 12)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

$definitions = @(
    @{
        Name = "HakkutsuLAB-0030"
        Group = "daily-0030"
        Trigger = New-ScheduledTaskTrigger -Daily -At "00:30"
    },
    @{
        Name = "HakkutsuLAB-1030"
        Group = "daily-1030"
        Trigger = New-ScheduledTaskTrigger -Daily -At "10:30"
    },
    @{
        Name = "HakkutsuLAB-TueFri-1800"
        Group = "tue-fri-1800"
        Trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Tuesday, Friday -At "18:00"
    },
    @{
        Name = "HakkutsuLAB-Sunday-1800"
        Group = "sunday-1800"
        Trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval 1 -DaysOfWeek Sunday -At "18:00"
    }
)

foreach ($definition in $definitions) {
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" $($definition.Group)"
    $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
    Register-ScheduledTask `
        -TaskName $definition.Name `
        -Action $action `
        -Trigger $definition.Trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "HakkutsuLAB local update: $($definition.Group)" `
        -Force | Out-Null
    Write-Host "Registered: $($definition.Name)"
}

Write-Host "All HakkutsuLAB scheduled tasks were registered."
Write-Host "Logs: $env:LOCALAPPDATA\HakkutsuLAB\scheduled-update-logs"
