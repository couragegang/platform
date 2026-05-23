#!/usr/bin/env bash
# Push baked images and update <contour>-latest. Args: compose services (default = all).
set -euo pipefail

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/deploy-catalog.sh
source "$PLATFORM_ROOT/scripts/deploy-catalog.sh"

OWNER="${IMAGE_OWNER:?IMAGE_OWNER required}"
TAG="${IMAGE_TAG:?IMAGE_TAG required}"
CONTOUR="${DEPLOY_CONTOUR:?DEPLOY_CONTOUR required}"
REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
latest_tag="${CONTOUR}-latest"

if [[ $# -gt 0 ]]; then
  COMPOSE_SERVICES=("$@")
else
  mapfile -t COMPOSE_SERVICES < <(deploy_catalog_all_compose_services)
fi

cd "$PLATFORM_ROOT"
docker compose -f docker-compose.bake.yml push "${COMPOSE_SERVICES[@]}"

for compose_svc in "${COMPOSE_SERVICES[@]}"; do
  ghcr_name="$(deploy_catalog_ghcr_for_compose "$compose_svc")"
  src="${REGISTRY}/${OWNER}/${ghcr_name}:${TAG}"
  dst="${REGISTRY}/${OWNER}/${ghcr_name}:${latest_tag}"
  docker pull "$src"
  docker tag "$src" "$dst"
  docker push "$dst"
  echo "tagged ${ghcr_name}:${latest_tag}"
done
