# Apply BC branch protection (unit + functional gates) to all microservice repos.
$ErrorActionPreference = "Stop"
$PlatformRoot = Split-Path -Parent $PSScriptRoot
$repos = @(
    "iam-service",
    "config-service",
    "mcp-gateway",
    "ai-runtime",
    "bff-gateway",
    "policy-service",
    "secrets-service",
    "audit-service",
    "knowledge-service"
)
foreach ($name in $repos) {
    & "$PlatformRoot\scripts\apply-branch-protection.ps1" -Repo "couragegang/$name" -Bc
}
