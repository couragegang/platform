#!/bin/sh
# Удаляет ВСЕ workflow chat-orchestrator / chat-tool-step (дубликаты от повторного import).
set -eu

N8N_USER_FOLDER="${N8N_USER_FOLDER:-/home/node/.n8n}"
DB="${N8N_USER_FOLDER}/database.sqlite"
MANAGED_IDS="cgChatOrchestr01 cgChatToolStp01"

if ! command -v n8n >/dev/null 2>&1; then
  echo "warn: n8n CLI not found, skip purge" >&2
  exit 0
fi

delete_workflow_id() {
  wf_id="$1"
  [ -z "$wf_id" ] && return 0
  echo "Deleting workflow id=$wf_id"
  n8n update:workflow --id="$wf_id" --active=false 2>/dev/null || true
  n8n delete:workflow --id="$wf_id" 2>/dev/null || echo "warn: delete failed id=$wf_id" >&2
}

if [ -f "$DB" ] && command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" "SELECT id FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step');" \
    | while IFS= read -r wf_id; do
      delete_workflow_id "$wf_id"
    done
else
  echo "warn: sqlite3 or DB missing, trying n8n export list" >&2
  for wf_id in $(n8n export:workflow --all 2>/dev/null | sed -n 's/.*"id":"\([^"]*\)".*"name":"chat-orchestrator".*/\1/p' 2>/dev/null || true); do
    delete_workflow_id "$wf_id"
  done
fi

# На случай старых записей с фиксированными id (перед re-import).
for wf_id in $MANAGED_IDS; do
  delete_workflow_id "$wf_id"
done
