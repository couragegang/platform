# Run unit coverage + E2E; push all sibling git repos only when both pass.
# Usage (from repo root or platform/):
#   .\platform\scripts\push-if-green.ps1
#   .\platform\scripts\push-if-green.ps1 -SkipE2e   # unit gate only

param(
    [switch]$SkipE2e,
    [string]$CommitMessage = "chore: sync changes after green unit and E2E gates."
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $PlatformRoot

Write-Host "=== Unit tests + JaCoCo (Docker) ===" -ForegroundColor Cyan
& "$PlatformRoot\scripts\verify-service-coverage.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Unit/coverage gate failed. Push aborted."
}

if (-not $SkipE2e) {
    Write-Host "`n=== E2E (docker compose + pytest) ===" -ForegroundColor Cyan
    Push-Location $PlatformRoot
    try {
        docker compose up -d --build
        if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

        $healthUrls = @(
            "http://localhost:8080/v1/iam/health",
            "http://localhost:8081/v1/mcp/health",
            "http://localhost:8082/v1/bff/health",
            "http://localhost:8083/v1/ai/health",
            "http://localhost:8084/v1/config/health",
            "http://localhost:8085/v1/policy/health",
            "http://localhost:8086/v1/audit/health",
            "http://localhost:8087/v1/secrets/health",
            "http://localhost:8088/v1/knowledge/health"
        )
        $ready = $false
        for ($i = 1; $i -le 60; $i++) {
            $ready = $true
            foreach ($u in $healthUrls) {
                try { Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3 | Out-Null }
                catch { $ready = $false; break }
            }
            if ($ready) { break }
            Start-Sleep -Seconds 5
        }
        if (-not $ready) { throw "Services not healthy within timeout" }

        $e2e = Join-Path $PlatformRoot "tests\e2e"
        if (-not (Test-Path "$e2e\.venv\Scripts\python.exe")) {
            python -m venv "$e2e\.venv"
        }
        & "$e2e\.venv\Scripts\pip" install -q -r "$e2e\requirements.txt"
        & "$e2e\.venv\Scripts\pytest" -m "phase1 or k or a" --tb=short
        if ($LASTEXITCODE -ne 0) { throw "E2E pytest failed" }
    }
    finally {
        Pop-Location
    }
}

$repoPaths = @(
    (Join-Path $WorkspaceRoot "cursor-context"),
    $PlatformRoot,
    (Join-Path $WorkspaceRoot "services\iam-service"),
    (Join-Path $WorkspaceRoot "services\mcp-gateway"),
    (Join-Path $WorkspaceRoot "services\bff-gateway"),
    (Join-Path $WorkspaceRoot "services\ai-runtime"),
    (Join-Path $WorkspaceRoot "services\config-service"),
    (Join-Path $WorkspaceRoot "services\policy-service"),
    (Join-Path $WorkspaceRoot "services\audit-service"),
    (Join-Path $WorkspaceRoot "services\secrets-service"),
    (Join-Path $WorkspaceRoot "services\knowledge-service"),
    (Join-Path $WorkspaceRoot "services\api-contracts")
)

Write-Host "`n=== Git push (repos with changes) ===" -ForegroundColor Cyan
foreach ($repo in $repoPaths) {
    if (-not (Test-Path (Join-Path $repo ".git"))) { continue }
    $status = git -C $repo status --porcelain
    if (-not $status) { continue }
    $name = Split-Path $repo -Leaf
    Write-Host "Pushing $name ..."
    git -C $repo add -A
    git -C $repo commit -m $CommitMessage
    git -C $repo push origin main
}

Write-Host "`nDone: all gates green, pushes completed." -ForegroundColor Green
