# One-time: set PLATFORM_DISPATCH_TOKEN on ui + all BC repos (same PAT as local `gh auth token`).
# Requires: gh auth login with repo + workflow scope.

$ErrorActionPreference = 'Stop'
$token = gh auth token
if (-not $token) { throw 'gh auth token failed — run: gh auth login' }

$repos = @(
  'couragegang/ui',
  'couragegang/iam-service',
  'couragegang/mcp-gateway',
  'couragegang/bff-gateway',
  'couragegang/ai-runtime',
  'couragegang/config-service',
  'couragegang/policy-service',
  'couragegang/secrets-service',
  'couragegang/audit-service',
  'couragegang/knowledge-service'
)

foreach ($r in $repos) {
  Write-Host "Setting PLATFORM_DISPATCH_TOKEN on $r ..."
  gh secret set PLATFORM_DISPATCH_TOKEN --repo $r --body $token
}

Write-Host 'Done.'
