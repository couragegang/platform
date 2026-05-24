#!/usr/bin/env bash
# Создаёт BC-базы в Postgres, если volume поднят до появления CREATE DATABASE в init-db.
# Безопасно повторять (идемпотентно). Запуск из deploy/vps на VPS:
#   cd /opt/couragegang-test && DEPLOY_CONTOUR=test ./ensure-databases.sh
set -euo pipefail
unset COMPOSE_FILE

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

DEPLOY_CONTOUR="${DEPLOY_CONTOUR:-prod}"
export DEPLOY_CONTOUR
export COMPOSE_PROJECT_NAME="couragegang-${DEPLOY_CONTOUR}"

COMPOSE_FILES=(docker-compose.yml)
if [[ "$DEPLOY_CONTOUR" == "test" ]]; then
  COMPOSE_FILES+=(docker-compose.ports-test.yml)
elif [[ "$DEPLOY_CONTOUR" == "prod" ]]; then
  COMPOSE_FILES+=(docker-compose.ports-prod.yml)
else
  echo "unknown DEPLOY_CONTOUR=$DEPLOY_CONTOUR" >&2
  exit 1
fi

TAG_FILE="$DIR/image-tags.env"
compose() {
  local -a cmd=(docker compose)
  local f
  for f in "${COMPOSE_FILES[@]}"; do
    cmd+=(-f "$f")
  done
  if [[ -f "$TAG_FILE" ]]; then
    cmd+=(--env-file "$TAG_FILE")
  fi
  "${cmd[@]}" "$@"
}

DATABASES=(iam config mcp policy secrets audit knowledge ai)

echo "Ensuring databases on contour=$DEPLOY_CONTOUR (project=$COMPOSE_PROJECT_NAME)..."

for db in "${DATABASES[@]}"; do
  exists="$(compose exec -T postgres psql -U platform -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${db}'" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$exists" == "1" ]]; then
    echo "  ok  $db"
  else
    echo "  +   CREATE DATABASE $db"
    compose exec -T postgres psql -U platform -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${db};"
  fi
done

echo "Done."
