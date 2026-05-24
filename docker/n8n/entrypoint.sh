#!/bin/sh
set -eu

if [ -f /app/config/runtime-baked.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /app/config/runtime-baked.env
  set +a
fi

# Импорт workflow из образа. Маркер версии — при смене bundle на VPS переимпортируется один раз.
# import:workflow по умолчанию деактивирует workflow — activate ниже.
WORKFLOW_BUNDLE_VERSION="${N8N_WORKFLOW_BUNDLE_VERSION:-v2-onReceived}"
IMPORT_MARKER="/home/node/.n8n/.workflows-imported-${WORKFLOW_BUNDLE_VERSION}"
if [ ! -f "$IMPORT_MARKER" ]; then
  mkdir -p /home/node/.n8n
  for f in /opt/workflows/*.json; do
    [ -f "$f" ] || continue
    echo "Importing workflow: $f"
    n8n import:workflow --input="$f" || echo "warn: import failed for $f" >&2
  done
  touch "$IMPORT_MARKER"
fi

echo "Activating workflows for production webhooks..."
if ! n8n update:workflow --all --active=true 2>/dev/null; then
  echo "warn: n8n update:workflow --all --active=true failed (check n8n CLI / DB)" >&2
fi

exec n8n
