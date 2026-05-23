#!/usr/bin/env bash
# Сборка web-ui и выкладка static на VPS (rsync).
# Usage: ./deploy-web-ui.sh prod|test [user@host]
set -euo pipefail

CONTOUR="${1:-prod}"
SSH_TARGET="${2:-}"

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_UI_ROOT="$(cd "$PLATFORM_ROOT/../web-ui" && pwd)"

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

cd "$WEB_UI_ROOT"
npm ci
npm run build

rsync -avz --delete "$WEB_UI_ROOT/dist/" "${SSH_TARGET}:${REMOTE_DIR}/"

echo "Deployed web-ui → ${SSH_TARGET}:${REMOTE_DIR} (contour=$CONTOUR)"
