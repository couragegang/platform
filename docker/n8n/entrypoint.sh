#!/bin/sh
set -eu

if [ -f /app/config/runtime-baked.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /app/config/runtime-baked.env
  set +a
fi

N8N_USER_FOLDER="${N8N_USER_FOLDER:-/home/node/.n8n}"
DB="${N8N_USER_FOLDER}/database.sqlite"
MANAGED_IDS="cgChatOrchestr01 cgChatToolStp01"

# Образ = единственный источник правды: purge дубликатов → import → activate только managed id.
if [ -x /opt/n8n/purge-managed-workflows.sh ]; then
  /opt/n8n/purge-managed-workflows.sh
fi

mkdir -p "$N8N_USER_FOLDER"
for f in /opt/workflows/*.json; do
  [ -f "$f" ] || continue
  echo "Importing workflow: $f"
  n8n import:workflow --input="$f" || echo "warn: import failed for $f" >&2
done

echo "Activating managed workflows only..."
for wf_id in $MANAGED_IDS; do
  if n8n update:workflow --id="$wf_id" --active=true 2>/dev/null; then
    echo "Activated id=$wf_id"
  else
    echo "warn: activate failed id=$wf_id" >&2
  fi
done

# Удалить лишние копии по имени (если purge/import оставили дубликаты).
if [ -f "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  for name in chat-orchestrator chat-tool-step; do
    keep_id=""
    case "$name" in
      chat-orchestrator) keep_id="cgChatOrchestr01" ;;
      chat-tool-step) keep_id="cgChatToolStp01" ;;
    esac
    sqlite3 "$DB" "SELECT id FROM workflow_entity WHERE name='$name' AND id != '$keep_id';" \
      | while IFS= read -r extra_id; do
        [ -z "$extra_id" ] && continue
        echo "Removing duplicate $name id=$extra_id"
        n8n update:workflow --id="$extra_id" --active=false 2>/dev/null || true
        n8n delete:workflow --id="$extra_id" 2>/dev/null || true
      done
  done
fi

exec n8n
