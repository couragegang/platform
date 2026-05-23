#!/usr/bin/env bash
# Клонирует микросервисы couragegang/* в ../services (для CI, когда checkout только platform).
set -euo pipefail

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICES_ROOT="$(cd "$PLATFORM_ROOT/../services" 2>/dev/null && pwd || echo "$PLATFORM_ROOT/../services")"
mkdir -p "$SERVICES_ROOT"

repos=(
  iam-service
  config-service
  policy-service
  secrets-service
  audit-service
  knowledge-service
  mcp-gateway
  ai-runtime
  bff-gateway
)

for repo in "${repos[@]}"; do
  dest="$SERVICES_ROOT/$repo"
  if [[ -d "$dest/.git" || -f "$dest/Dockerfile" ]]; then
    echo "skip $repo (already present)"
    continue
  fi
  echo "clone $repo -> $dest"
  git clone --depth 1 "https://github.com/couragegang/${repo}.git" "$dest"
done

echo "Services ready under $SERVICES_ROOT"
