#!/usr/bin/env bash
# Сборка SPA (pnpm monorepo ui/) и выкладка static на VPS (rsync).
# CI: push couragegang/ui test/main → trigger-deploy → platform deploy-web-ui.yml
# Usage: ./deploy-web-ui.sh prod|test [user@host]
set -euo pipefail

CONTOUR="${1:-prod}"
SSH_TARGET="${2:-}"

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$PLATFORM_ROOT/.." && pwd)"
if [[ -f "$WORKSPACE_ROOT/ui/pnpm-workspace.yaml" ]]; then
  UI_ROOT="$(cd "$WORKSPACE_ROOT/ui" && pwd)"
elif [[ -d "$WORKSPACE_ROOT/ui/web-ui" ]]; then
  UI_ROOT="$(cd "$WORKSPACE_ROOT/ui/web-ui" && pwd)"
elif [[ -d "$WORKSPACE_ROOT/web-ui" ]]; then
  UI_ROOT="$(cd "$WORKSPACE_ROOT/web-ui" && pwd)"
else
  echo "UI not found: expected $WORKSPACE_ROOT/ui (monorepo) or legacy web-ui/" >&2
  exit 1
fi

case "$CONTOUR" in
  prod)
    REMOTE_DIR="/var/www/ai.valoriel.ru"
    ;;
  test)
    REMOTE_DIR="/var/www/ai-test.valoriel.ru"
    ;;
  *)
    echo "Usage: $0 prod|test [user@host]" >&2
    exit 1
    ;;
esac

if [[ -z "$SSH_TARGET" ]]; then
  echo "Set SSH target: $0 $CONTOUR root@155.212.171.36" >&2
  exit 1
fi

if [[ -f "$UI_ROOT/pnpm-workspace.yaml" ]]; then
  cd "$UI_ROOT"
  pnpm install --frozen-lockfile
  pnpm --filter @couragegang/web build
  DIST_DIR="$UI_ROOT/apps/web/dist"
else
  cd "$UI_ROOT"
  npm ci
  npm run build
  DIST_DIR="$UI_ROOT/dist"
fi

rsync -avz --delete "$DIST_DIR/" "${SSH_TARGET}:${REMOTE_DIR}/"

echo "Deployed SPA → ${SSH_TARGET}:${REMOTE_DIR} (contour=$CONTOUR)"
