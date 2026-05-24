#!/bin/sh
# Удаляет ВСЕ workflow chat-orchestrator / chat-tool-step из SQLite.
# n8n 1.121: команды delete:workflow нет — только прямой DELETE в БД (n8n остановлен).
set -eu

N8N_USER_FOLDER="${N8N_USER_FOLDER:-/home/node/.n8n}"
DB="${N8N_USER_FOLDER}/database.sqlite"
MANAGED_NAMES="chat-orchestrator chat-tool-step"

purge_managed_in_sqlite() {
  if [ ! -f "$DB" ] || ! command -v sqlite3 >/dev/null 2>&1; then
    echo "warn: sqlite3 or $DB missing, cannot purge workflows" >&2
    return 1
  fi

  count="$(sqlite3 "$DB" "SELECT COUNT(*) FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step');" 2>/dev/null || echo 0)"
  if [ "$count" = "0" ]; then
    echo "No managed workflows in DB to purge"
    return 0
  fi

  echo "Purging $count managed workflow(s) from SQLite..."

  # Связанные таблицы (n8n 1.x) — best-effort, игнорируем отсутствующие.
  sqlite3 "$DB" <<'EOSQL' 2>/dev/null || true
DELETE FROM webhook_entity WHERE workflowId IN (
  SELECT id FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step')
);
DELETE FROM shared_workflow WHERE workflowId IN (
  SELECT id FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step')
);
DELETE FROM workflows_tags WHERE workflowId IN (
  SELECT id FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step')
);
DELETE FROM workflow_history WHERE workflowId IN (
  SELECT id FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step')
);
DELETE FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step');
EOSQL

  remaining="$(sqlite3 "$DB" "SELECT COUNT(*) FROM workflow_entity WHERE name IN ('chat-orchestrator','chat-tool-step');" 2>/dev/null || echo 0)"
  if [ "$remaining" != "0" ]; then
    echo "warn: $remaining managed workflow row(s) still in DB after purge" >&2
    return 1
  fi
  echo "Purged managed workflows from DB"
}

purge_managed_in_sqlite
