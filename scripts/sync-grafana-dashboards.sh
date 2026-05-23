#!/usr/bin/env bash
# Copy services/*/grafana/*.json → deploy/observability/grafana/dashboards/<repo>/
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICES_ROOT="${SERVICES_ROOT:-$(cd "$PLATFORM_ROOT/.." && pwd)/services}"
DEST="$PLATFORM_ROOT/deploy/observability/grafana/dashboards"

repos=(
  iam-service config-service mcp-gateway bff-gateway ai-runtime
  policy-service secrets-service audit-service knowledge-service
)

mkdir -p "$DEST"
for repo in "${repos[@]}"; do
  src="$SERVICES_ROOT/$repo/grafana"
  if [[ ! -d "$src" ]]; then
    echo "skip $repo — no grafana/" >&2
    continue
  fi
  mkdir -p "$DEST/$repo"
  cp -f "$src"/*.json "$DEST/$repo/"
  echo "synced $repo"
done
echo "Done."
