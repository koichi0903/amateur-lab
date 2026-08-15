$taskNames = @(
    "HakkutsuLAB-0030",
    "HakkutsuLAB-1030",
    "HakkutsuLAB-TueFri-1800",
    "HakkutsuLAB-Sunday-1800"
)

foreach ($taskName in $taskNames) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Removed (if present): $taskName"
}
