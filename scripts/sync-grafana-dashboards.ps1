# Copy services/*/grafana/*.json -> dashboards/ (VPS) and dashboards-local/ (local, без выбора DS)
param(
    [string]$ServicesRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\services")).Path,
    [string]$ObsRoot = (Join-Path $PSScriptRoot "..\deploy\observability\grafana")
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$PatchScript = Join-Path $PlatformRoot "scripts\patch-grafana-dashboard-local.py"

$DashboardsVps = Join-Path $ObsRoot "dashboards"
$DashboardsLocal = Join-Path $ObsRoot "dashboards-local"

$repos = @(
    "iam-service", "config-service", "mcp-gateway", "bff-gateway", "ai-runtime",
    "policy-service", "secrets-service", "audit-service", "knowledge-service"
)

function Sync-JsonFile($src, $vpsDest, $localDest) {
    Copy-Item $src $vpsDest -Force
    & py -3 $PatchScript $src $localDest
    if ($LASTEXITCODE -ne 0) {
        throw "patch-grafana-dashboard-local.py failed for $src"
    }
}

New-Item -ItemType Directory -Force -Path $DashboardsVps, $DashboardsLocal | Out-Null

foreach ($repo in $repos) {
    $srcDir = Join-Path (Join-Path $ServicesRoot $repo) "grafana"
    if (-not (Test-Path $srcDir)) {
        Write-Warning "Skip $repo - no grafana folder"
        continue
    }
    $vpsDir = Join-Path $DashboardsVps $repo
    $localDir = Join-Path $DashboardsLocal $repo
    New-Item -ItemType Directory -Force -Path $vpsDir, $localDir | Out-Null
    Get-ChildItem (Join-Path $srcDir "*.json") | ForEach-Object {
        Sync-JsonFile $_.FullName (Join-Path $vpsDir $_.Name) (Join-Path $localDir $_.Name)
    }
    Write-Host "Synced $repo -> VPS + local"
}

$platformSrc = Join-Path $DashboardsVps "platform\platform-overview.json"
if (Test-Path $platformSrc) {
    $localOverview = Join-Path $DashboardsLocal "platform\platform-overview.json"
    & py -3 $PatchScript $platformSrc $localOverview
    if ($LASTEXITCODE -ne 0) { throw "patch platform-overview failed" }
    Write-Host "Synced platform-overview -> local"
}

Write-Host "Done. VPS: Contour selector | Local: single Prometheus (no selector)."
