# Пересборка сервисов, которые дергает Web UI через BFF.
# Запускать из platform/: .\scripts\rebuild-web-backend.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

Write-Host "Rebuilding iam, config, mcp, ai, bff..." -ForegroundColor Cyan
docker compose build iam config mcp ai bff
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Ensuring DB 'ai' exists (for older postgres volumes)..." -ForegroundColor Cyan
docker exec platform-postgres-1 psql -U platform -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'ai'" 2>$null | Out-Null
$hasAi = docker exec platform-postgres-1 psql -U platform -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'ai'" 2>$null
if (-not ($hasAi -match "1")) {
    docker exec platform-postgres-1 psql -U platform -d postgres -c "CREATE DATABASE ai;"
}

Write-Host "Restarting services..." -ForegroundColor Cyan
docker compose up -d iam config mcp ai bff

Write-Host "Done. BFF: http://localhost:8082/v1/bff/api/me" -ForegroundColor Green
