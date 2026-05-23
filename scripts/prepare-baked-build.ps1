param(
    [ValidateSet("prod")]
    [string]$Contour = "prod"
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot "fetch-build-secrets.ps1") -Contour $Contour -OutputFile (Join-Path $PlatformRoot "build\runtime-secrets.env")

$bash = Get-Command bash -ErrorAction SilentlyContinue
if (-not $bash) {
    throw "bash required for prepare-baked-build (Git Bash or WSL)"
}
$env:DEPLOY_CONTOUR = $Contour
& bash (Join-Path $PSScriptRoot "prepare-baked-build.sh") $Contour
