# Apply .github/branch-protection.json to test and main (platform or BC repo).
# Usage: .\scripts\apply-branch-protection.ps1 [-Repo couragegang/iam-service]
param(
    [string]$Repo = "couragegang/platform"
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$inputFile = Join-Path $PlatformRoot ".github\branch-protection.json"

if (-not (Test-Path $inputFile)) {
    Write-Error "Missing $inputFile"
}

foreach ($branch in @("test", "main")) {
    Write-Host "Applying protection to $Repo branch $branch ..."
    gh api --method PUT "repos/$Repo/branches/$branch/protection" --input $inputFile
}

Write-Host "Done." -ForegroundColor Green
