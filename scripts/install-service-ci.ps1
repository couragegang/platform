# Install functional/unit workflows and pytest skeleton into each BC repo.
param(
    [string]$ServicesRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\services")).Path
)

$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$templateTests = Join-Path $PlatformRoot "templates\service-tests-functional"
$wfFunctional = Join-Path $PlatformRoot "templates\service-functional-tests.yml"
$wfUnit = Join-Path $PlatformRoot "templates\service-unit-tests.yml"

$services = @(
    @{ id = "iam"; dir = "iam-service" },
    @{ id = "config"; dir = "config-service" },
    @{ id = "mcp"; dir = "mcp-gateway" },
    @{ id = "ai"; dir = "ai-runtime" },
    @{ id = "bff"; dir = "bff-gateway" },
    @{ id = "policy"; dir = "policy-service" },
    @{ id = "secrets"; dir = "secrets-service" },
    @{ id = "audit"; dir = "audit-service" },
    @{ id = "knowledge"; dir = "knowledge-service" }
)

foreach ($s in $services) {
    $repo = Join-Path $ServicesRoot $s.dir
    if (-not (Test-Path $repo)) {
        Write-Warning "Skip missing $repo"
        continue
    }
    $testsDir = Join-Path $repo "tests\functional"
    New-Item -ItemType Directory -Force -Path $testsDir | Out-Null
    Copy-Item (Join-Path $templateTests "*") $testsDir -Force
    $regress = Join-Path $PlatformRoot "templates\service-tests-functional-regress\$($s.id)\test_regress.py"
    if (Test-Path $regress) {
        Copy-Item $regress (Join-Path $testsDir "test_regress.py") -Force
    }

    $wfDir = Join-Path $repo ".github\workflows"
    New-Item -ItemType Directory -Force -Path $wfDir | Out-Null
    (Get-Content $wfFunctional -Raw) `
        -replace "__SERVICE_ID__", $s.id `
        -replace "__SERVICE_DIR__", $s.dir |
        Set-Content (Join-Path $wfDir "functional-tests.yml")
    Copy-Item $wfUnit (Join-Path $wfDir "unit-tests.yml") -Force

    Write-Host "Installed CI + functional tests -> $($s.dir)"
}

Write-Host "Done. Customize tests/functional/test_regress.py per BC if needed."
