#!/usr/bin/env bash
# In BC repo CI: copy current checkout into services/<name> and clone siblings from GitHub.
set -euo pipefail

SERVICE_DIR_NAME="${1:?service directory e.g. iam-service}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="${PLATFORM_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
SERVICES_ROOT="${SERVICES_ROOT:-$WORKSPACE/services}"

mkdir -p "$SERVICES_ROOT"
dest="$SERVICES_ROOT/$SERVICE_DIR_NAME"

if [[ ! -f "$dest/Dockerfile" ]]; then
  echo "Copy PR branch -> $dest"
  mkdir -p "$dest"
  rsync -a "$WORKSPACE/" "$dest/" \
    --exclude platform \
    --exclude services \
    --exclude .git
fi

export SERVICES_ROOT
export PLATFORM_ROOT
cd "$PLATFORM_ROOT"
chmod +x scripts/checkout-services.sh
./scripts/checkout-services.sh

echo "Services tree ready at $SERVICES_ROOT"
