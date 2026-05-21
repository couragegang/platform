# JaCoCo branch >= 80% for each Java service (requires JDK 21 via Gradle toolchain)
$ErrorActionPreference = "Stop"
$servicesRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\services")
$services = @(
    "iam-service",
    "policy-service",
    "audit-service",
    "secrets-service",
    "ai-runtime",
    "bff-gateway",
    "mcp-gateway",
    "config-service",
    "knowledge-service"
)
$failed = @()
foreach ($name in $services) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    Push-Location (Join-Path $servicesRoot $name)
    try {
        & .\gradlew.bat test jacocoTestCoverageVerification --no-daemon -q
        if ($LASTEXITCODE -ne 0) { $failed += $name }
    } finally {
        Pop-Location
    }
}
if ($failed.Count -gt 0) {
    Write-Error "Coverage check failed: $($failed -join ', ')"
}
Write-Host "`nAll services passed branch coverage >= 80%" -ForegroundColor Green
