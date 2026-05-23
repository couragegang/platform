# Copy services/*/grafana/*.json to deploy/observability/grafana/dashboards/<service>/
param(
    [string]$ServicesRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\services")).Path,
    [string]$ObservabilityDashboards = (Join-Path $PSScriptRoot "..\deploy\observability\grafana\dashboards")
)

$ErrorActionPreference = "Stop"
$repos = @(
    "iam-service", "config-service", "mcp-gateway", "bff-gateway", "ai-runtime",
    "policy-service", "secrets-service", "audit-service", "knowledge-service"
)

New-Item -ItemType Directory -Force -Path $ObservabilityDashboards | Out-Null

foreach ($repo in $repos) {
    $src = Join-Path (Join-Path $ServicesRoot $repo) "grafana"
    if (-not (Test-Path $src)) {
        Write-Warning "Skip $repo - no grafana folder"
        continue
    }
    $dest = Join-Path $ObservabilityDashboards $repo
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item (Join-Path $src "*.json") $dest -Force
    Write-Host "Synced $repo -> $dest"
}

Write-Host "Done. Grafana reloads dashboards every 30s via provisioning."
