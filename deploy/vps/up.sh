#!/usr/bin/env bash
# На VPS: pull + up без локальных .env (конфиг внутри образов).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

DEPLOY_CONTOUR="${DEPLOY_CONTOUR:-prod}"
export DEPLOY_CONTOUR

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
if [[ -z "$IMAGE_TAG" ]]; then
  echo "Usage: DEPLOY_CONTOUR=test|prod IMAGE_TAG=<sha>-<contour> $0" >&2
  echo "   or: $0 <sha>-<contour>" >&2
  exit 1
fi

export IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
export IMAGE_OWNER="${IMAGE_OWNER:-couragegang}"
export COMPOSE_PROJECT_NAME="couragegang-${DEPLOY_CONTOUR}"

COMPOSE_FILES=(docker-compose.yml)
if [[ "$DEPLOY_CONTOUR" == "test" && -f docker-compose.ports-test.yml ]]; then
  COMPOSE_FILES+=(docker-compose.ports-test.yml)
fi
export COMPOSE_FILE="${COMPOSE_FILES[*]// /:}"

echo "Deploy contour=$DEPLOY_CONTOUR tag=$IMAGE_TAG owner=$IMAGE_OWNER project=$COMPOSE_PROJECT_NAME"
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
