#!/usr/bin/env bash
# Run pytest smoke/regress for one BC (tests/functional in service repo).
# Usage: SERVICE_ID=iam ./scripts/run-functional-tests.sh
# Env: PLATFORM_ROOT, SERVICES_ROOT, SUITE (or auto via resolve-functional-suite.sh)
set -euo pipefail

SERVICE_ID="${SERVICE_ID:?SERVICE_ID required (iam, config, mcp, ...)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_ROOT="${PLATFORM_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SERVICES_ROOT="${SERVICES_ROOT:-$(cd "$PLATFORM_ROOT/../services" 2>/dev/null && pwd || echo "$PLATFORM_ROOT/../services")}"

# shellcheck source=functional-service-map.sh
source "$SCRIPT_DIR/functional-service-map.sh"

if [[ -z "${SUITE:-}" ]]; then
  # shellcheck source=resolve-functional-suite.sh
  source "$SCRIPT_DIR/resolve-functional-suite.sh"
fi

dir="${SERVICE_DIRS[$SERVICE_ID]:-}"
if [[ -z "$dir" ]]; then
  echo "Unknown SERVICE_ID=$SERVICE_ID" >&2
  exit 1
fi

TESTS_DIR="$SERVICES_ROOT/$dir/tests/functional"
if [[ ! -d "$TESTS_DIR" ]]; then
  echo "Missing tests: $TESTS_DIR" >&2
  exit 1
fi

export PLATFORM_ROOT
export PYTHONPATH="${PLATFORM_ROOT}/tests/e2e${PYTHONPATH:+:$PYTHONPATH}"

if [[ ! -f "$PLATFORM_ROOT/tests/e2e/requirements.txt" ]]; then
  echo "platform e2e requirements not found under $PLATFORM_ROOT" >&2
  exit 1
fi

python3 -m pip install -q -r "$PLATFORM_ROOT/tests/e2e/requirements.txt"
cd "$TESTS_DIR"
echo "pytest -m $SUITE in $TESTS_DIR"
python3 -m pytest -m "$SUITE" --tb=short -q
