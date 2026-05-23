#!/usr/bin/env bash
# Sets SUITE=smoke|regress from GitHub event (PR base branch or push ref).
# smoke: MR/push -> test; regress: MR/push -> main
set -euo pipefail

target=""
if [[ "${GITHUB_EVENT_NAME:-}" == "pull_request" ]]; then
  target="${GITHUB_BASE_REF:-test}"
elif [[ "${GITHUB_REF:-}" == refs/heads/* ]]; then
  target="${GITHUB_REF#refs/heads/}"
else
  target="${DEPLOY_CONTOUR:-test}"
  [[ "$target" == "prod" ]] && target="main"
  [[ "$target" == "local" ]] && target="test"
fi

if [[ "$target" == "main" ]]; then
  export SUITE=regress
else
  export SUITE=smoke
fi

echo "Functional suite=$SUITE (target branch=$target)"
