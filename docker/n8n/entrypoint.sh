#!/bin/sh
set -eu

if [ -f /app/config/runtime-baked.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /app/config/runtime-baked.env
  set +a
fi

# Импорт workflow из образа (один раз на volume).
if [ ! -f /home/node/.n8n/.workflows-imported ]; then
  mkdir -p /home/node/.n8n
  for f in /opt/workflows/*.json; do
    [ -f "$f" ] || continue
    echo "Importing workflow: $f"
    n8n import:workflow --input="$f" || echo "warn: import failed for $f" >&2
  done
  touch /home/node/.n8n/.workflows-imported
fi

exec n8n
