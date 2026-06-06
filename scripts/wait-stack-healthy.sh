#!/usr/bin/env bash
# Poll HTTP health endpoints until all pass or timeout (used by CI e2e).
set -euo pipefail

MAX_ATTEMPTS="${STACK_HEALTH_MAX_ATTEMPTS:-120}"
SLEEP_SECS="${STACK_HEALTH_SLEEP_SECS:-5}"

endpoints=(
  "iam:8080:/v1/iam/health"
  "mcp:8081:/v1/mcp/health"
  "bff:8082:/v1/bff/health"
  "ai:8083:/v1/ai/health"
  "config:8084:/v1/config/health"
  "policy:8085:/v1/policy/health"
  "audit:8086:/v1/audit/health"
  "secrets:8087:/v1/secrets/health"
  "knowledge:8088:/v1/knowledge/health"
)

echo "Waiting for stack health (max ${MAX_ATTEMPTS} attempts, ${SLEEP_SECS}s interval)..."
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  pending=()
  for entry in "${endpoints[@]}"; do
    name="${entry%%:*}"
    rest="${entry#*:}"
    port="${rest%%:*}"
    path="${rest#*:}"
    if curl -sf "http://localhost:${port}${path}" >/dev/null 2>&1; then
      continue
    fi
    pending+=("$name")
  done

  if ((${#pending[@]} == 0)); then
    echo "All healthy (attempt ${attempt})"
    exit 0
  fi

  echo "attempt ${attempt}/${MAX_ATTEMPTS}: pending ${pending[*]}"
  sleep "$SLEEP_SECS"
done

echo "Stack health timeout after $((MAX_ATTEMPTS * SLEEP_SECS))s"
docker compose ps || true
docker compose logs --tail=80 || true
exit 1
