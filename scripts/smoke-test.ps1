# Smoke E2E: health → IAM register → BFF me/catalog/chat → knowledge connectors
# Требует: docker compose up в platform/
# Секреты: platform/.env (см. .env.example)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-dotenv.ps1")
Import-PlatformDotEnv

$healthUrls = @(
    @{ Name = "iam"; Url = "http://localhost:8080/v1/iam/health" },
    @{ Name = "mcp"; Url = "http://localhost:8081/v1/mcp/health" },
    @{ Name = "bff"; Url = "http://localhost:8082/v1/bff/health" },
    @{ Name = "ai"; Url = "http://localhost:8083/v1/ai/health" },
    @{ Name = "config"; Url = "http://localhost:8084/v1/config/health" },
    @{ Name = "policy"; Url = "http://localhost:8085/v1/policy/health" },
    @{ Name = "audit"; Url = "http://localhost:8086/v1/audit/health" },
    @{ Name = "secrets"; Url = "http://localhost:8087/v1/secrets/health" },
    @{ Name = "knowledge"; Url = "http://localhost:8088/v1/knowledge/health" }
)

$iam = "http://localhost:8080/v1/iam"
$bff = "http://localhost:8082/v1/bff"
$mcp = "http://localhost:8081/v1/mcp"
$config = "http://localhost:8084/v1/config"

Write-Host "0. Health checks..."
foreach ($h in $healthUrls) {
    $r = Invoke-WebRequest -Uri $h.Url -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -ne 200) {
        throw "$($h.Name) unhealthy: $($r.StatusCode)"
    }
}
Write-Host "   OK all services UP"

$email = "smoke-$(Get-Random)@example.com"
$password = if ($env:E2E_PASSWORD) { $env:E2E_PASSWORD } else { "SmokeTest-Password-1" }

Write-Host "1. Register + org..."
$regBody = @{
    email = $email
    password = $password
    displayName = "Smoke User"
    organizationName = "Smoke Org"
} | ConvertTo-Json

$reg = Invoke-RestMethod -Method Post -Uri "$iam/auth/register" -ContentType "application/json" -Body $regBody
$token = $reg.accessToken
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   OK token received"

Write-Host "2. BFF /api/me..."
$me = Invoke-RestMethod -Method Get -Uri "$bff/api/me" -Headers $headers
Write-Host "   userId=$($me.userId) orgId=$($me.orgId)"

Write-Host "3. MCP catalog (via BFF)..."
$cat = Invoke-RestMethod -Method Get -Uri "$bff/api/mcp/catalog" -Headers $headers -TimeoutSec 30
if (-not ($cat.items | Where-Object { $_.connectorKey -eq "notion" })) {
    throw "catalog missing notion connector"
}
Write-Host "   OK catalog items: $($cat.items.Count)"

if ($me.workspaceId) {
    $workspaceId = $me.workspaceId
} else {
    Write-Host "4. Resolve workspace via config..."
    $ws = Invoke-RestMethod -Method Get -Uri "$config/orgs/$($me.orgId)/workspaces" -Headers $headers
    $workspaceId = $ws.items[0].id
}
Write-Host "   workspaceId=$workspaceId"

if ($env:NOTION_SMOKE_TOKEN) {
    Write-Host "5. Install Notion (NOTION_SMOKE_TOKEN set)..."
    $mcpHeaders = $headers.Clone()
    $mcpHeaders["X-Org-Id"] = "$($me.orgId)"
    $mcpHeaders["X-User-Id"] = "$($me.userId)"
    $installBody = @{
        connectorKey = "notion"
        displayLabel = "Notion smoke"
        form = @{ integration_token = $env:NOTION_SMOKE_TOKEN }
    } | ConvertTo-Json -Depth 5
    $inst = Invoke-RestMethod -Method Post `
        -Uri "$mcp/workspaces/$workspaceId/installations" `
        -Headers $mcpHeaders -ContentType "application/json" -Body $installBody
    Write-Host "   installation id=$($inst.id) status=$($inst.status)"
} else {
    Write-Host "5. Skip Notion install (set NOTION_SMOKE_TOKEN to test secrets+policy path)"
}

Write-Host "6. BFF chat..."
$chatHeaders = $headers.Clone()
$chatHeaders["X-Workspace-Id"] = "$workspaceId"
$chatBody = (@{ message = "hello smoke test" } | ConvertTo-Json -Compress)
$chat = Invoke-RestMethod -Method Post -Uri "$bff/api/chat" -Headers $chatHeaders -ContentType "application/json" -Body $chatBody -TimeoutSec 60
if (-not $chat.reply) { throw "chat missing reply: $($chat | ConvertTo-Json -Compress)" }
$expectedStatus = if (($env:LLM_PROVIDER -eq "deepseek") -and $env:DEEPSEEK_API_KEY) { "completed" } else { "stub" }
if ($chat.status -ne $expectedStatus) {
    Write-Warning "chat status=$($chat.status) (expected $expectedStatus for current LLM_PROVIDER)"
}
Write-Host "   chat status=$($chat.status)"

Write-Host "7. Knowledge connectors (BFF)..."
$kc = Invoke-RestMethod -Method Get -Uri "$bff/api/knowledge/connectors" -Headers $headers -TimeoutSec 30
if (-not ($kc.items | Where-Object { $_.connectorKey -eq "notion" })) {
    throw "knowledge connectors missing notion"
}
Write-Host "   OK knowledge connectors"

Write-Host "Smoke test completed."
