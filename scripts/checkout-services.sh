#!/usr/bin/env bash
# Клонирует микросервисы couragegang/* в ../services (CI: только checkout platform).
# Ветка: SERVICE_BRANCH или по контуру (test→test, prod→main).
set -euo pipefail

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICES_ROOT="${SERVICES_ROOT:-$(cd "$PLATFORM_ROOT/../services" 2>/dev/null && pwd || echo "$PLATFORM_ROOT/../services")}"
mkdir -p "$SERVICES_ROOT"

CONTOUR="${DEPLOY_CONTOUR:-test}"
if [[ -n "${SERVICE_BRANCH:-}" ]]; then
  BRANCH="$SERVICE_BRANCH"
elif [[ "$CONTOUR" == "prod" ]]; then
  BRANCH="main"
else
  BRANCH="test"
fi

FORCE="${FORCE_SERVICE_CHECKOUT:-}"
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  FORCE=1
fi

if [[ -n "${CHECKOUT_ONLY_REPO:-}" ]]; then
  repos=("$CHECKOUT_ONLY_REPO")
else
  repos=(
    iam-service
    config-service
    policy-service
    secrets-service
    audit-service
    knowledge-service
    mcp-gateway
    mcp-notion
    ai-runtime
    bff-gateway
  )
fi

for repo in "${repos[@]}"; do
  dest="$SERVICES_ROOT/$repo"
  if [[ -n "$FORCE" ]] && [[ -d "$dest" ]]; then
    rm -rf "$dest"
  fi
  if [[ -d "$dest/.git" ]] || [[ -f "$dest/Dockerfile" ]]; then
    echo "skip $repo (already present at $dest)"
    continue
  fi
  echo "clone couragegang/${repo}@${BRANCH} -> $dest"
  token="${SERVICE_CHECKOUT_TOKEN:-${GITHUB_TOKEN:-}}"
  if [[ -n "$token" ]]; then
    git clone --depth 1 --branch "$BRANCH" \
      "https://x-access-token:${token}@github.com/couragegang/${repo}.git" "$dest"
  else
    git clone --depth 1 --branch "$BRANCH" "https://github.com/couragegang/${repo}.git" "$dest"
  fi
done

echo "Services ready under $SERVICES_ROOT (branch=$BRANCH, contour=$CONTOUR)"
