# n8n workflow unit tests + static JSON validation (ESM-free bundled Code nodes).
# Usage (from platform/):
#   .\scripts\verify-n8n-workflows.ps1
#   .\scripts\verify-n8n-workflows.ps1 -Force

param(
    [switch]$Force,
    [string]$PlatformRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$N8nRoot = Join-Path $PlatformRoot "n8n"

function Test-N8nChangesPending {
    param([string]$Repo)
    if (-not (Test-Path (Join-Path $Repo ".git"))) { return $false }

    $porcelain = git -C $Repo status --porcelain -- n8n/
    if ($porcelain) { return $true }

    $null = git -C $Repo rev-parse --verify "@{u}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }

    $diff = git -C $Repo diff --name-only "@{u}..HEAD" -- n8n/
    return [bool]$diff
}

if (-not $Force) {
    if (-not (Test-N8nChangesPending -Repo $PlatformRoot)) {
        Write-Host "No n8n changes (working tree or unpushed commits) - n8n gate skipped." -ForegroundColor Yellow
        Write-Host "Use -Force to run anyway." -ForegroundColor DarkGray
        exit 0
    }
    Write-Host "n8n changes detected - running workflow tests." -ForegroundColor Cyan
}

if (-not (Test-Path $N8nRoot)) {
    Write-Error "n8n directory not found: $N8nRoot"
}

Push-Location $N8nRoot
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed in n8n/" }

    npm run validate
    if ($LASTEXITCODE -ne 0) { throw "npm run validate failed in n8n/" }

    Write-Host "n8n workflow gate passed." -ForegroundColor Green
}
finally {
    Pop-Location
}
