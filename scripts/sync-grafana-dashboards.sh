#!/usr/bin/env bash
# dashboards/ (VPS, выбор контура) + dashboards-local/ (скрытый datasource)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICES_ROOT="${SERVICES_ROOT:-$(cd "$PLATFORM_ROOT/.." && pwd)/services}"
OBS_ROOT="$PLATFORM_ROOT/deploy/observability/grafana"
PATCH="$PLATFORM_ROOT/scripts/patch-grafana-dashboard-local.py"

repos=(
  iam-service config-service mcp-gateway bff-gateway ai-runtime
  policy-service secrets-service audit-service knowledge-service
)

sync_file() {
  local src="$1" vps="$2" local="$3"
  cp -f "$src" "$vps"
  python3 "$PATCH" "$src" "$local"
}

mkdir -p "$OBS_ROOT/dashboards" "$OBS_ROOT/dashboards-local"

for repo in "${repos[@]}"; do
  src="$SERVICES_ROOT/$repo/grafana"
  [[ -d "$src" ]] || { echo "skip $repo"; continue; }
  mkdir -p "$OBS_ROOT/dashboards/$repo" "$OBS_ROOT/dashboards-local/$repo"
  for f in "$src"/*.json; do
    [[ -f "$f" ]] || continue
    base="$(basename "$f")"
    sync_file "$f" "$OBS_ROOT/dashboards/$repo/$base" "$OBS_ROOT/dashboards-local/$repo/$base"
  done
  echo "synced $repo"
done

overview="$OBS_ROOT/dashboards/platform/platform-overview.json"
if [[ -f "$overview" ]]; then
  mkdir -p "$OBS_ROOT/dashboards-local/platform"
  python3 "$PATCH" "$overview" "$OBS_ROOT/dashboards-local/platform/platform-overview.json"
fi

echo "Done."
