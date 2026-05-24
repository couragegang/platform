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

delete_workflow_sqlite() {
  wf_id="$1"
  [ -z "$wf_id" ] || [ ! -f "$DB" ] || ! command -v sqlite3 >/dev/null 2>&1 && return 0
  sqlite3 "$DB" <<EOSQL 2>/dev/null || true
DELETE FROM webhook_entity WHERE workflowId = '$wf_id';
DELETE FROM shared_workflow WHERE workflowId = '$wf_id';
DELETE FROM workflows_tags WHERE workflowId = '$wf_id';
DELETE FROM workflow_history WHERE workflowId = '$wf_id';
DELETE FROM workflow_entity WHERE id = '$wf_id';
EOSQL
}

# n8n ещё не запущен: purge SQLite → import → active flags в DB.
if [ -x /opt/n8n/purge-managed-workflows.sh ]; then
  /opt/n8n/purge-managed-workflows.sh
fi

mkdir -p "$N8N_USER_FOLDER"
for f in /opt/workflows/*.json; do
  [ -f "$f" ] || continue
  echo "Importing workflow: $f"
  n8n import:workflow --input="$f" || echo "warn: import failed for $f" >&2
done

# Дубликаты по имени (старые random id после неудачного delete:workflow).
if [ -f "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  for name in chat-orchestrator chat-tool-step; do
    keep_id="cgChatOrchestr01"
    [ "$name" = "chat-tool-step" ] && keep_id="cgChatToolStp01"
    sqlite3 "$DB" "SELECT id FROM workflow_entity WHERE name='$name' AND id != '$keep_id';" 2>/dev/null \
      | while IFS= read -r extra_id; do
        [ -z "$extra_id" ] && continue
        echo "Removing duplicate $name id=$extra_id"
        delete_workflow_sqlite "$extra_id"
      done
  done
fi

echo "Marking managed workflows active in DB..."
if [ -f "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  for wf_id in $MANAGED_IDS; do
    sqlite3 "$DB" "UPDATE workflow_entity SET active = 1 WHERE id = '$wf_id';" 2>/dev/null || true
    echo "DB active=1 id=$wf_id"
  done
  sqlite3 "$DB" "UPDATE workflow_entity SET active = 0 WHERE name IN ('chat-orchestrator','chat-tool-step') AND id NOT IN ('cgChatOrchestr01','cgChatToolStp01');" 2>/dev/null || true
fi

exec n8n
