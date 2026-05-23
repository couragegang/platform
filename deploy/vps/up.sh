#!/usr/bin/env bash
# На VPS: pull + up без локальных .env (конфиг внутри образов).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
if [[ -z "$IMAGE_TAG" ]]; then
  echo "Usage: IMAGE_TAG=<git-sha> $0" >&2
  echo "   or: $0 <git-sha>" >&2
  exit 1
fi

export IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
export IMAGE_OWNER="${IMAGE_OWNER:-couragegang}"

echo "Deploy contour=prod tag=$IMAGE_TAG owner=$IMAGE_OWNER"
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
