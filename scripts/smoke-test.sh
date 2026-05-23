#!/usr/bin/env bash
# Smoke E2E (bash): health → register → BFF me/catalog/chat → knowledge connectors
# Usage: from platform/ — ./scripts/smoke-test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

check_health() {
  local name="$1" url="$2"
  local code
  code="$(curl -sf -o /dev/null -w "%{http_code}" "$url" || echo "000")"
  [[ "$code" == "200" ]] || { echo "FAIL $name ($url) HTTP $code"; exit 1; }
}

echo "0. Health checks..."
check_health iam    "http://localhost:8080/v1/iam/health"
check_health mcp    "http://localhost:8081/v1/mcp/health"
check_health bff    "http://localhost:8082/v1/bff/health"
check_health ai     "http://localhost:8083/v1/ai/health"
check_health config "http://localhost:8084/v1/config/health"
check_health policy "http://localhost:8085/v1/policy/health"
check_health audit  "http://localhost:8086/v1/audit/health"
check_health secrets "http://localhost:8087/v1/secrets/health"
check_health knowledge "http://localhost:8088/v1/knowledge/health"
echo "   OK all services UP"

IAM="http://localhost:8080/v1/iam"
BFF="http://localhost:8082/v1/bff"
MCP="http://localhost:8081/v1/mcp"
CONFIG="http://localhost:8084/v1/config"
EMAIL="smoke-$(date +%s)@example.com"
PASSWORD="${E2E_PASSWORD:-SmokeTest-Password-1}"

echo "1. Register + org..."
REG=$(curl -sf -X POST "$IAM/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"Smoke\",\"organizationName\":\"Smoke Org\"}")
TOKEN=$(echo "$REG" | python -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
AUTH="Authorization: Bearer $TOKEN"
echo "   OK token"

echo "2. BFF /api/me..."
ME=$(curl -sf -H "$AUTH" "$BFF/api/me")
ORG_ID=$(echo "$ME" | python -c "import sys,json; print(json.load(sys.stdin)['orgId'])")
USER_ID=$(echo "$ME" | python -c "import sys,json; print(json.load(sys.stdin)['userId'])")
echo "   userId=$USER_ID orgId=$ORG_ID"

echo "3. MCP catalog..."
curl -sf -H "$AUTH" "$BFF/api/mcp/catalog" | python -c "
import sys, json
items = json.load(sys.stdin).get('items', [])
assert any(i.get('connectorKey')=='notion' for i in items), items
print('   OK catalog', len(items), 'items')
"

WS_ID=$(echo "$ME" | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('workspaceId') or '')")
if [[ -z "$WS_ID" ]]; then
  echo "4. Workspace via config..."
  WS_ID=$(curl -sf -H "$AUTH" "$CONFIG/orgs/$ORG_ID/workspaces" | python -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")
fi
echo "   workspaceId=$WS_ID"

if [[ -n "${NOTION_SMOKE_TOKEN:-}" ]]; then
  echo "5. Install Notion..."
  curl -sf -X POST "$MCP/workspaces/$WS_ID/installations" \
    -H "$AUTH" -H "X-Org-Id: $ORG_ID" -H "X-User-Id: $USER_ID" \
    -H "Content-Type: application/json" \
    -d "{\"connectorKey\":\"notion\",\"displayLabel\":\"smoke\",\"form\":{\"integration_token\":\"$NOTION_SMOKE_TOKEN\"}}" \
    | python -c "import sys,json; d=json.load(sys.stdin); print('   id', d['id'])"
else
  echo "5. Skip Notion (NOTION_SMOKE_TOKEN unset)"
fi

echo "6. BFF chat..."
CHAT=$(curl -sf -X POST "$BFF/api/chat" -H "$AUTH" -H "X-Workspace-Id: $WS_ID" \
  -H "Content-Type: application/json" -d '{"message":"hello smoke test"}')
echo "$CHAT" | python -c "import sys,json; d=json.load(sys.stdin); assert d.get('reply'); print('   status', d.get('status'))"

echo "7. Knowledge connectors..."
curl -sf -H "$AUTH" "$BFF/api/knowledge/connectors" | python -c "
import sys, json
items = json.load(sys.stdin).get('items', [])
assert any(i.get('connectorKey')=='notion' for i in items)
print('   OK knowledge connectors')
"

echo "Smoke test completed."
