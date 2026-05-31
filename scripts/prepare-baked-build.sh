#!/usr/bin/env bash
# Готовит docker/runtime-baked.env + entrypoint в каждом микросервисе для target baked.
set -euo pipefail

CONTOUR="${1:-prod}"
ONLY_REPO="${2:-}"
PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVICES_ROOT="${SERVICES_ROOT:-$PLATFORM_ROOT/../services}"
if [[ -d "$SERVICES_ROOT" ]]; then
  SERVICES_ROOT="$(cd "$SERVICES_ROOT" && pwd)"
fi
SECRETS_ENV="$PLATFORM_ROOT/build/runtime-secrets.env"
ENTRYPOINT_SRC="$PLATFORM_ROOT/docker/entrypoint-baked.sh"

chmod +x "$PLATFORM_ROOT/scripts/fetch-build-secrets.sh"
"$PLATFORM_ROOT/scripts/fetch-build-secrets.sh" "$CONTOUR" "$SECRETS_ENV"

if [[ ! -f "$ENTRYPOINT_SRC" ]]; then
  echo "Missing $ENTRYPOINT_SRC" >&2
  exit 1
fi

PUBLIC_BASE="${VPS_PUBLIC_BASE_URL:-}"
if [[ -n "$PUBLIC_BASE" ]]; then
  PUBLIC_BASE="${PUBLIC_BASE%/}"
  OIDC_EXTRA="$PLATFORM_ROOT/build/oidc-baked.env"
  {
    echo "OIDC_GOOGLE_REDIRECT_URI=${PUBLIC_BASE}/v1/iam/auth/oidc/google/callback"
    echo "OIDC_GITHUB_REDIRECT_URI=${PUBLIC_BASE}/v1/iam/auth/oidc/github/callback"
  } > "$OIDC_EXTRA"
else
  OIDC_EXTRA=""
fi

# service_dir:db_name:jar:fragment
SPECS=(
  "iam-service:iam:iam-service.jar:iam.env"
  "config-service:config:config-service.jar:config.env"
  "policy-service:policy:policy-service.jar:policy.env"
  "secrets-service:secrets:secrets-service.jar:secrets.env"
  "audit-service:audit:audit-service.jar:audit.env"
  "knowledge-service:knowledge:knowledge-service.jar:knowledge.env"
  "mcp-notion::mcp-notion.jar:mcp-notion.env"
  "mcp-trello::mcp-trello.jar:mcp-trello.env"
  "mcp-gateway:mcp:app.jar:mcp.env"
  "ai-runtime:ai:app.jar:ai.env"
  "bff-gateway::app.jar:bff.env"
)

for spec in "${SPECS[@]}"; do
  IFS=: read -r dir db_name jar fragment <<< "$spec"
  if [[ -n "$ONLY_REPO" && "$dir" != "$ONLY_REPO" ]]; then
    continue
  fi
  svc_path="$SERVICES_ROOT/$dir"
  if [[ ! -d "$svc_path" ]]; then
    echo "skip $dir (not found at $svc_path)" >&2
    continue
  fi
  docker_dir="$svc_path/docker"
  mkdir -p "$docker_dir"
  echo "runtime-baked.env" > "$docker_dir/.gitignore"
  cp "$ENTRYPOINT_SRC" "$docker_dir/entrypoint-baked.sh"
  chmod +x "$docker_dir/entrypoint-baked.sh"

  out="$docker_dir/runtime-baked.env"
  {
    echo "DEPLOY_CONTOUR=$CONTOUR"
    echo "APP_JAR=/app/$jar"
    cat "$PLATFORM_ROOT/config/bake/static.env"
    cat "$SECRETS_ENV"
    if [[ -n "$db_name" ]]; then
      echo "DB_NAME=$db_name"
    fi
    frag="$PLATFORM_ROOT/config/bake/fragments/$fragment"
    if [[ -f "$frag" ]]; then
      cat "$frag"
    fi
    if [[ -n "$OIDC_EXTRA" && "$dir" == "iam-service" ]]; then
      cat "$OIDC_EXTRA"
    fi
  } | awk '/^[A-Za-z_][A-Za-z0-9_]*=/ {
      eq = index($0, "=")
      key = substr($0, 1, eq - 1)
      val = substr($0, eq + 1)
      if (val != "") last[key] = $0
    }
    END { for (k in last) print last[k] }' > "$out"

  echo "baked env -> $dir/docker/runtime-baked.env"
done

prepare_n8n_baked_env() {
  if [[ -n "$ONLY_REPO" && "$ONLY_REPO" != "platform" && "$ONLY_REPO" != "n8n" ]]; then
    return 0
  fi
  docker_dir="$PLATFORM_ROOT/docker/n8n"
  mkdir -p "$docker_dir"
  echo "runtime-baked.env" >"$docker_dir/.gitignore"
  chmod +x "$docker_dir/entrypoint.sh"

  # UI n8n — на SPA-домене (/n8n), не на VPS_PUBLIC_BASE_URL (часто API/OIDC другой host).
  n8n_ui_base() {
    if [[ -n "${N8N_PUBLIC_BASE_URL:-}" ]]; then
      echo "${N8N_PUBLIC_BASE_URL%/}"
      return
    fi
    case "$CONTOUR" in
      test) echo "https://ai-test.valoriel.ru" ;;
      prod) echo "https://ai.valoriel.ru" ;;
    esac
  }

  out="$docker_dir/runtime-baked.env"
  {
    echo "DEPLOY_CONTOUR=$CONTOUR"
    cat "$PLATFORM_ROOT/config/bake/fragments/n8n.env"
    n8n_base="$(n8n_ui_base)"
    if [[ -n "$n8n_base" ]]; then
      echo "N8N_PATH=/n8n/"
      echo "N8N_EDITOR_BASE_URL=${n8n_base}/n8n/"
      echo "WEBHOOK_URL=${n8n_base}/n8n/"
      echo "N8N_PROTOCOL=https"
      echo "N8N_PROXY_HOPS=1"
    fi
    for key in AI_INTERNAL_API_KEY POLICY_INTERNAL_API_KEY MCP_INTERNAL_API_KEY; do
      grep "^${key}=" "$SECRETS_ENV" || true
    done
  } | awk '/^[A-Za-z_][A-Za-z0-9_]*=/ {
      eq = index($0, "=")
      key = substr($0, 1, eq - 1)
      val = substr($0, eq + 1)
      if (val != "") last[key] = $0
    }
    END { for (k in last) print last[k] }' >"$out"
  echo "baked env -> docker/n8n/runtime-baked.env"
}

prepare_n8n_baked_env

echo "Prepare baked build complete (contour=$CONTOUR only_repo=${ONLY_REPO:-all})"
