#!/usr/bin/env bash
# VPS: pull + up. Tags in image-tags.env (per-service).
# Full stack:  ./up.sh <sha>-<contour>
# One service: ./up.sh <sha>-<contour> <compose-service>   (e.g. ai)
set -euo pipefail
# Do not use COMPOSE_FILE env (space-separated paths break docker compose on Linux).
unset COMPOSE_FILE
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

DEPLOY_CONTOUR="${DEPLOY_CONTOUR:-prod}"
export DEPLOY_CONTOUR

IMAGE_TAG="${1:-${IMAGE_TAG:-}}"
if [[ -z "$IMAGE_TAG" ]]; then
  echo "Usage: DEPLOY_CONTOUR=test|prod $0 <tag> [compose-service ...]" >&2
  echo "  full:  $0 abc123-test" >&2
  echo "  one:   $0 abc123-test ai" >&2
  exit 1
fi

export IMAGE_TAG
export IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
export IMAGE_OWNER="${IMAGE_OWNER:-couragegang}"
export COMPOSE_PROJECT_NAME="couragegang-${DEPLOY_CONTOUR}"
CONTOUR_LATEST="${DEPLOY_CONTOUR}-latest"

COMPOSE_FILES=(docker-compose.yml)
if [[ "$DEPLOY_CONTOUR" == "test" ]]; then
  if [[ ! -f docker-compose.ports-test.yml ]]; then
    echo "missing $DIR/docker-compose.ports-test.yml (sync deploy/vps from platform repo)" >&2
    exit 1
  fi
  COMPOSE_FILES+=(docker-compose.ports-test.yml)
elif [[ "$DEPLOY_CONTOUR" == "prod" ]]; then
  if [[ ! -f docker-compose.ports-prod.yml ]]; then
    echo "missing $DIR/docker-compose.ports-prod.yml (sync deploy/vps from platform repo)" >&2
    exit 1
  fi
  COMPOSE_FILES+=(docker-compose.ports-prod.yml)
else
  echo "unknown DEPLOY_CONTOUR=$DEPLOY_CONTOUR (expected test or prod)" >&2
  exit 1
fi

for f in "${COMPOSE_FILES[@]}"; do
  if [[ ! -f "$DIR/$f" ]]; then
    echo "missing compose file: $DIR/$f" >&2
    exit 1
  fi
done

TAG_FILE="$DIR/image-tags.env"

tag_key_for_compose() {
  case "$1" in
    postgres) echo IMAGE_TAG_POSTGRES ;;
    config) echo IMAGE_TAG_CONFIG ;;
    policy) echo IMAGE_TAG_POLICY ;;
    secrets) echo IMAGE_TAG_SECRETS ;;
    audit) echo IMAGE_TAG_AUDIT ;;
    iam) echo IMAGE_TAG_IAM ;;
    mcp-notion) echo IMAGE_TAG_MCP_NOTION ;;
    mcp) echo IMAGE_TAG_MCP ;;
    knowledge) echo IMAGE_TAG_KNOWLEDGE ;;
    ai) echo IMAGE_TAG_AI ;;
    bff) echo IMAGE_TAG_BFF ;;
    n8n) echo IMAGE_TAG_N8N ;;
    *) echo "unknown compose service: $1" >&2; return 1 ;;
  esac
}

all_tag_keys() {
  printf '%s\n' IMAGE_TAG_POSTGRES IMAGE_TAG_CONFIG IMAGE_TAG_POLICY IMAGE_TAG_SECRETS \
    IMAGE_TAG_AUDIT IMAGE_TAG_IAM IMAGE_TAG_MCP_NOTION IMAGE_TAG_MCP IMAGE_TAG_KNOWLEDGE IMAGE_TAG_AI IMAGE_TAG_BFF IMAGE_TAG_N8N
}

upsert_tag() {
  local key="$1" value="$2"
  touch "$TAG_FILE"
  if grep -q "^${key}=" "$TAG_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$TAG_FILE"
  else
    echo "${key}=${value}" >>"$TAG_FILE"
  fi
}

ensure_defaults() {
  local key
  while IFS= read -r key; do
    if ! grep -q "^${key}=" "$TAG_FILE" 2>/dev/null; then
      echo "${key}=${CONTOUR_LATEST}" >>"$TAG_FILE"
    fi
  done < <(all_tag_keys)
}

set_all_tags() {
  local tag="$1" key
  : >"$TAG_FILE"
  while IFS= read -r key; do
    echo "${key}=${tag}" >>"$TAG_FILE"
  done < <(all_tag_keys)
}

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

shift || true
SERVICES=("$@")

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "Deploy ALL contour=$DEPLOY_CONTOUR tag=$IMAGE_TAG"
  set_all_tags "$IMAGE_TAG"
  compose pull
  compose up -d --remove-orphans --force-recreate
else
  ensure_defaults
  for svc in "${SERVICES[@]}"; do
    key="$(tag_key_for_compose "$svc")"
    upsert_tag "$key" "$IMAGE_TAG"
    echo "Deploy ONE contour=$DEPLOY_CONTOUR service=$svc tag=$IMAGE_TAG ($key)"
  done
  compose pull "${SERVICES[@]}"
  compose up -d --force-recreate "${SERVICES[@]}"
fi

compose ps
