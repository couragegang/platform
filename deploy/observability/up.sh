#!/usr/bin/env bash
# Pull + up observability stack.
# Local (default): один Prometheus → host 8080–8088
# VPS: OBSERVABILITY_PROFILE=vps → prometheus-test + prometheus-prod
set -euo pipefail
unset COMPOSE_FILE
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
PLATFORM_ROOT="$(cd "$DIR/../.." && pwd)"

OBSERVABILITY_PROFILE="${OBSERVABILITY_PROFILE:-local}"

if [[ ! -f .env && -f .env.example ]]; then
  echo "Hint: copy .env.example to .env and set GRAFANA_ADMIN_PASSWORD" >&2
fi

if [[ -f "$PLATFORM_ROOT/scripts/sync-grafana-dashboards.sh" ]]; then
  echo "Syncing dashboards from services/*/grafana ..."
  bash "$PLATFORM_ROOT/scripts/sync-grafana-dashboards.sh"
fi

if [[ "$OBSERVABILITY_PROFILE" == "vps" ]]; then
  COMPOSE_FILES=(docker-compose.yml)
  echo "Observability profile: vps (prometheus-test + prometheus-prod)"
else
  COMPOSE_FILES=(docker-compose.local.yml)
  echo "Observability profile: local (single prometheus → 8080–8088)"
fi

compose() {
  local -a cmd=(docker compose)
  local f
  for f in "${COMPOSE_FILES[@]}"; do
    cmd+=(-f "$f")
  done
  if [[ -f .env ]]; then
    cmd+=(--env-file .env)
  fi
  "${cmd[@]}" "$@"
}

echo "Observability: up (${COMPOSE_FILES[*]})"
compose pull
compose up -d --remove-orphans --force-recreate
compose ps
