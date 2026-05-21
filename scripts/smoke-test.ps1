# Smoke E2E: IAM -> BFF -> MCP catalog -> (optional install) -> chat
# Требует: docker compose up в platform/

$ErrorActionPreference = "Stop"
$iam = "http://localhost:8080/v1/iam"
$bff = "http://localhost:8082/v1/bff"
$mcp = "http://localhost:8081/v1/mcp"

$email = "smoke-$(Get-Random)@example.com"
$password = "SmokeTest-Password-1"

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

Write-Host "3. MCP catalog..."
$catRaw = Invoke-WebRequest -Method Get -Uri "$bff/api/mcp/catalog" -Headers $headers -UseBasicParsing -TimeoutSec 30
Write-Host "   catalog bytes: $($catRaw.Content.Length)"

if (-not $me.workspaceId) {
    Write-Host "4. Resolve workspace via config..."
    $orgId = $me.orgId
    $ws = Invoke-RestMethod -Method Get -Uri "http://localhost:8084/v1/config/orgs/$orgId/workspaces" -Headers $headers
    $workspaceId = $ws.items[0].id
} else {
    $workspaceId = $me.workspaceId
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
$chat = Invoke-WebRequest -Method Post -Uri "$bff/api/chat" -Headers $chatHeaders -ContentType "application/json" -Body $chatBody -UseBasicParsing -TimeoutSec 30
Write-Host "   chat: $($chat.Content)"

Write-Host "Smoke test completed."
