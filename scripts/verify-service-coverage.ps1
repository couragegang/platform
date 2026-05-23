# JaCoCo branch >= 80% for each Java service (JDK 21 via Docker gradle image)
$ErrorActionPreference = "Stop"
$servicesRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\services")
$gradleImage = if ($env:GRADLE_DOCKER_IMAGE) { $env:GRADLE_DOCKER_IMAGE } else { "gradle:8.10.2-jdk21" }
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
    $dir = (Join-Path $servicesRoot $name)
    docker run --rm -v "${dir}:/app" -w /app $gradleImage gradle test jacocoTestCoverageVerification --no-daemon -q
    if ($LASTEXITCODE -ne 0) { $failed += $name }
}
if ($failed.Count -gt 0) {
    Write-Error "Coverage check failed: $($failed -join ', ')"
}
Write-Host "`nAll services passed branch coverage >= 80%" -ForegroundColor Green
