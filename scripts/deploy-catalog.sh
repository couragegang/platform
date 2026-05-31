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
    mcp-notion) echo "mcp-notion|mcp-notion|mcp-notion|IMAGE_TAG_MCP_NOTION" ;;
    mcp-trello) echo "mcp-trello|mcp-trello|mcp-trello|IMAGE_TAG_MCP_TRELLO" ;;
    mcp-gateway) echo "mcp|mcp-gateway|mcp|IMAGE_TAG_MCP" ;;
    knowledge-service) echo "knowledge|knowledge-service|knowledge|IMAGE_TAG_KNOWLEDGE" ;;
    ai-runtime) echo "ai|ai-runtime|ai|IMAGE_TAG_AI" ;;
    bff-gateway) echo "bff|bff-gateway|bff|IMAGE_TAG_BFF" ;;
    n8n) echo "n8n|n8n|n8n|IMAGE_TAG_N8N" ;;
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
    iam-service mcp-notion mcp-trello mcp-gateway knowledge-service ai-runtime bff-gateway
}

deploy_catalog_all_compose_services() {
  printf '%s\n' postgres config policy secrets audit iam mcp-notion mcp-trello mcp knowledge ai bff n8n
}

deploy_catalog_ghcr_for_compose() {
  case "$1" in
    postgres) echo platform-postgres ;;
    config) echo config-service ;;
    policy) echo policy-service ;;
    secrets) echo secrets-service ;;
    audit) echo audit-service ;;
    iam) echo iam-service ;;
    mcp-notion) echo mcp-notion ;;
    mcp-trello) echo mcp-trello ;;
    mcp) echo mcp-gateway ;;
    knowledge) echo knowledge-service ;;
    ai) echo ai-runtime ;;
    bff) echo bff-gateway ;;
    n8n) echo n8n ;;
    *) echo "unknown compose service: $1" >&2; return 1 ;;
  esac
}
