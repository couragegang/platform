# Apply branch protection to test and main (platform, BC, or api-contracts).
# Usage:
#   .\scripts\apply-branch-protection.ps1
#   .\scripts\apply-branch-protection.ps1 -Repo couragegang/iam-service -Bc
#   .\scripts\apply-branch-protection.ps1 -Repo couragegang/api-contracts -Contracts
param(
    [string]$Repo = "couragegang/platform",
    [switch]$Bc,
    [switch]$Contracts
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$inputFile = if ($Contracts) {
    Join-Path $PlatformRoot ".github\branch-protection-api-contracts.json"
} elseif ($Bc) {
    Join-Path $PlatformRoot ".github\branch-protection-bc.json"
} else {
    Join-Path $PlatformRoot ".github\branch-protection.json"
}

if (-not (Test-Path $inputFile)) {
    Write-Error "Missing $inputFile"
}

foreach ($branch in @("test", "main")) {
    Write-Host "Applying protection to $Repo branch $branch ..."
    gh api --method PUT "repos/$Repo/branches/$branch/protection" --input $inputFile
}

Write-Host "Done." -ForegroundColor Green
