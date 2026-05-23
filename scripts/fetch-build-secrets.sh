#!/usr/bin/env bash
# Собирает build/runtime.env для docker compose (local | test | prod).
set -euo pipefail

CONTOUR="${1:-local}"
PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="${2:-$PLATFORM_ROOT/build/runtime.env}"
KEYS_FILE="$PLATFORM_ROOT/config/contours/secret-keys.txt"
CONTOUR_FILE="$PLATFORM_ROOT/config/contours/${CONTOUR}.env"
DOTENV="$PLATFORM_ROOT/.env"

declare -A VALUES

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="$(echo "$line" | xargs)"
    [[ -z "$line" ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo "$key" | xargs)"
    val="$(echo "$val" | xargs)"
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    [[ -n "$key" && -n "$val" ]] && VALUES["$key"]="$val"
  done < "$f"
}

load_env_file "$CONTOUR_FILE"
VALUES["DEPLOY_CONTOUR"]="$CONTOUR"

if [[ "$CONTOUR" == "local" ]]; then
  load_env_file "$DOTENV"
fi

while IFS= read -r key || [[ -n "$key" ]]; do
  key="$(echo "$key" | xargs)"
  [[ -z "$key" || "$key" == \#* ]] && continue
  if [[ -n "${!key:-}" ]]; then
    VALUES["$key"]="${!key}"
  fi
done < "$KEYS_FILE"

required=(JWT_SECRET SECRETS_ENCRYPTION_KEY CONFIG_INTERNAL_API_KEY POLICY_INTERNAL_API_KEY SECRETS_INTERNAL_API_KEY AUDIT_INTERNAL_API_KEY)
if [[ "$CONTOUR" == "prod" ]]; then
  missing=()
  for k in "${required[@]}"; do
    [[ -z "${VALUES[$k]:-}" ]] && missing+=("$k")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Contour prod: missing secrets: ${missing[*]}" >&2
    exit 1
  fi
fi

mkdir -p "$(dirname "$OUTPUT")"
{
  echo "DEPLOY_CONTOUR=$CONTOUR"
  while IFS= read -r key || [[ -n "$key" ]]; do
    key="$(echo "$key" | xargs)"
    [[ -z "$key" || "$key" == \#* ]] && continue
    val="${VALUES[$key]:-}"
    [[ -n "$val" ]] && printf '%s="%s"\n' "$key" "${val//\"/\\\"}"
  done < "$KEYS_FILE"
} > "$OUTPUT"

echo "Wrote runtime env for contour '$CONTOUR' -> $OUTPUT"
