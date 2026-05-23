# Local observability up (single Prometheus)
param(
    [switch]$NoSync
)

$ErrorActionPreference = "Stop"
$ObsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PlatformRoot = Split-Path -Parent (Split-Path -Parent $ObsDir)

if (-not $NoSync) {
    & (Join-Path $PlatformRoot "scripts\sync-grafana-dashboards.ps1")
}

Push-Location $ObsDir
try {
    $env:OBSERVABILITY_PROFILE = "local"
    docker compose -f docker-compose.local.yml --env-file .env pull
    docker compose -f docker-compose.local.yml --env-file .env up -d --remove-orphans --force-recreate
    docker compose -f docker-compose.local.yml ps
} finally {
    Pop-Location
}

Write-Host "Grafana: http://localhost:3000  Prometheus: http://localhost:9090"
