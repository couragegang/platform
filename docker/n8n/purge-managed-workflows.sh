#!/bin/sh
# Удаляет все workflow chat-orchestrator / chat-tool-step перед re-import (дубликаты ломают webhook).
set -eu

names="chat-orchestrator chat-tool-step"

if ! command -v n8n >/dev/null 2>&1; then
  echo "warn: n8n CLI not found, skip purge" >&2
  exit 0
fi

list_out="$(n8n list:workflow 2>/dev/null || true)"
if [ -z "$list_out" ]; then
  exit 0
fi

echo "$list_out" | while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in
    *ID*|*Name*|*---*)
      continue
      ;;
  esac
  wf_id=""
  wf_name=""
  if echo "$line" | grep -q '|'; then
    wf_id="$(echo "$line" | cut -d'|' -f1 | tr -d ' ')"
    wf_name="$(echo "$line" | cut -d'|' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  else
    wf_id="$(echo "$line" | awk '{print $1}')"
    wf_name="$(echo "$line" | awk '{$1=""; sub(/^ /,""); print}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  fi
  [ -z "$wf_id" ] && continue
  for n in $names; do
    if [ "$wf_name" = "$n" ]; then
      echo "Deleting managed workflow: $wf_name ($wf_id)"
      n8n delete:workflow --id="$wf_id" 2>/dev/null || echo "warn: delete failed for $wf_id" >&2
      break
    fi
  done
done
