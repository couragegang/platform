#!/usr/bin/env bash
# GitHub repo name -> bake compose service | GHCR image | VPS compose service | IMAGE_TAG_* key
set -euo pipefail

deploy_catalog_resolve() {
  local repo="${1#*/}"
  case "$repo" in
    config-service) echo "config|config-service|config|IMAGE_TAG_CONFIG" ;;
    policy-service) echo "policy|policy-service|policy|IMAGE_TAG_POLICY" ;;
    secrets-service) echo "secrets|secrets-service|secrets|IMAGE_TAG_SECRETS" ;;
    audit-service) echo "audit|audit-service|audit|IMAGE_TAG_AUDIT" ;;
    iam-service) echo "iam|iam-service|iam|IMAGE_TAG_IAM" ;;
    mcp-gateway) echo "mcp|mcp-gateway|mcp|IMAGE_TAG_MCP" ;;
    knowledge-service) echo "knowledge|knowledge-service|knowledge|IMAGE_TAG_KNOWLEDGE" ;;
    ai-runtime) echo "ai|ai-runtime|ai|IMAGE_TAG_AI" ;;
    bff-gateway) echo "bff|bff-gateway|bff|IMAGE_TAG_BFF" ;;
    platform) echo "postgres|platform-postgres|postgres|IMAGE_TAG_POSTGRES" ;;
    *)
      echo "unknown repo: $repo" >&2
      return 1
      ;;
  esac
}

deploy_catalog_all_repos() {
  printf '%s\n' \
    config-service policy-service secrets-service audit-service \
    iam-service mcp-gateway knowledge-service ai-runtime bff-gateway
}

deploy_catalog_all_compose_services() {
  printf '%s\n' postgres config policy secrets audit iam mcp knowledge ai bff
}

deploy_catalog_ghcr_for_compose() {
  case "$1" in
    postgres) echo platform-postgres ;;
    config) echo config-service ;;
    policy) echo policy-service ;;
    secrets) echo secrets-service ;;
    audit) echo audit-service ;;
    iam) echo iam-service ;;
    mcp) echo mcp-gateway ;;
    knowledge) echo knowledge-service ;;
    ai) echo ai-runtime ;;
    bff) echo bff-gateway ;;
    *) echo "unknown compose service: $1" >&2; return 1 ;;
  esac
}
