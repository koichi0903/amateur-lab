$scriptPath = Join-Path $PSScriptRoot "start-local-dev.ps1"
$cases = @(
    @{ Name = "same-repo PID -> reuse"; Case = "same-repo"; Expected = "same-repo" },
    @{ Name = "known different amateur-lab -> refuse without stopping"; Case = "known-different"; Expected = "known-different" },
    @{ Name = "unknown process -> never kill"; Case = "unknown"; Expected = "unknown" },
    @{ Name = "no port owner -> start"; Case = "no-owner"; Expected = "no-owner" }
)

foreach ($test in $cases) {
    $result = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -TestCase $test.Case | ConvertFrom-Json
    if ($result.classification -ne $test.Expected) {
        throw "$($test.Name): expected $($test.Expected), got $($result.classification)"
    }
    Write-Host "PASS: $($test.Name)"
}
