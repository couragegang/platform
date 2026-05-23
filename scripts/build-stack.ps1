# fetch-build-secrets + docker compose build/up для контура local|test|prod.

param(
    [ValidateSet("local", "test", "prod")]
    [string]$Contour = "local",
    [switch]$BuildOnly,
    [switch]$Up,
    [switch]$Detach
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
Push-Location $PlatformRoot
try {
    & (Join-Path $PSScriptRoot "fetch-build-secrets.ps1") -Contour $Contour
    $env:DEPLOY_CONTOUR = $Contour
    $composeArgs = @("compose")
    if ($BuildOnly) {
        $composeArgs += "build"
    } elseif ($Up) {
        if ($Detach) { $composeArgs += "up", "-d", "--build" }
        else { $composeArgs += "up", "--build" }
    } else {
        $composeArgs += "build"
    }
    & docker @composeArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
