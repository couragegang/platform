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
HASH_MARKER="${N8N_USER_FOLDER}/.workflows-bundle.sha256"
MANAGED_IDS="cgChatOrchestr01 cgChatToolStp01 cgChatConnNot01 cgChatConnTrello01"

bundle_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    find /opt/workflows -maxdepth 1 -name '*.json' -print 2>/dev/null | sort | xargs sha256sum 2>/dev/null | sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    find /opt/workflows -maxdepth 1 -name '*.json' -print 2>/dev/null | sort | xargs shasum -a 256 2>/dev/null | shasum -a 256 | awk '{print $1}'
  else
    echo "warn: no sha256 tool, will import every start" >&2
    echo "unknown"
  fi
}

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

remove_duplicate_managed() {
  [ -f "$DB" ] || return 0
  command -v sqlite3 >/dev/null 2>&1 || return 0
  for name in chat-orchestrator chat-tool-step chat-connector-notion chat-connector-trello; do
    keep_id="cgChatOrchestr01"
    [ "$name" = "chat-tool-step" ] && keep_id="cgChatToolStp01"
    [ "$name" = "chat-connector-notion" ] && keep_id="cgChatConnNot01"
    [ "$name" = "chat-connector-trello" ] && keep_id="cgChatConnTrello01"
    sqlite3 "$DB" "SELECT id FROM workflow_entity WHERE name='$name' AND id != '$keep_id';" 2>/dev/null \
      | while IFS= read -r extra_id; do
        [ -z "$extra_id" ] && continue
        echo "Removing duplicate $name id=$extra_id"
        delete_workflow_sqlite "$extra_id"
      done
  done
}

managed_workflows_present() {
  [ -f "$DB" ] || return 1
  command -v sqlite3 >/dev/null 2>&1 || return 1
  present="$(sqlite3 "$DB" "SELECT COUNT(*) FROM workflow_entity WHERE id IN ('cgChatOrchestr01','cgChatToolStp01','cgChatConnNot01','cgChatConnTrello01');" 2>/dev/null || echo 0)"
  [ "$present" = "4" ]
}

ensure_managed_active() {
  [ -f "$DB" ] || return 0
  command -v sqlite3 >/dev/null 2>&1 || return 0
  for wf_id in $MANAGED_IDS; do
    sqlite3 "$DB" "UPDATE workflow_entity SET active = 1 WHERE id = '$wf_id';" 2>/dev/null || true
  done
  sqlite3 "$DB" "UPDATE workflow_entity SET active = 0 WHERE name IN ('chat-orchestrator','chat-tool-step','chat-connector-notion','chat-connector-trello') AND id NOT IN ('cgChatOrchestr01','cgChatToolStp01','cgChatConnNot01','cgChatConnTrello01');" 2>/dev/null || true
}

mkdir -p "$N8N_USER_FOLDER"
remove_duplicate_managed

current_hash="$(bundle_hash)"
stored_hash=""
[ -f "$HASH_MARKER" ] && stored_hash="$(cat "$HASH_MARKER" 2>/dev/null || true)"

need_import=0
if [ "${FORCE_WORKFLOW_REIMPORT:-}" = "1" ]; then
  echo "FORCE_WORKFLOW_REIMPORT=1 — full re-import"
  need_import=1
elif [ "$current_hash" = "unknown" ]; then
  need_import=1
elif [ ! -f "$HASH_MARKER" ] || [ "$current_hash" != "$stored_hash" ]; then
  echo "Workflow bundle changed (hash ${current_hash:-empty} != ${stored_hash:-none})"
  need_import=1
elif ! managed_workflows_present; then
  echo "Managed workflows missing in DB — import required"
  need_import=1
else
  echo "Workflow bundle unchanged — skip import (stats preserved)"
fi

if [ "$need_import" = "1" ]; then
  if [ "${FORCE_WORKFLOW_REIMPORT:-}" = "1" ] && [ -x /opt/n8n/purge-managed-workflows.sh ]; then
    echo "Full purge before import (FORCE_WORKFLOW_REIMPORT)"
    /opt/n8n/purge-managed-workflows.sh
  fi
  for f in /opt/workflows/*.json; do
    [ -f "$f" ] || continue
    echo "Importing workflow: $f"
    n8n import:workflow --input="$f" || echo "warn: import failed for $f" >&2
  done
  if [ -n "$current_hash" ] && [ "$current_hash" != "unknown" ]; then
    echo "$current_hash" >"$HASH_MARKER"
  fi
  remove_duplicate_managed
fi

echo "Ensuring managed workflows active in DB..."
ensure_managed_active

exec n8n
