#!/usr/bin/env bash
# Maps contracts-sync / deploy id -> service directory name.
declare -A SERVICE_DIRS=(
  [iam]=iam-service
  [config]=config-service
  [mcp]=mcp-gateway
  [ai]=ai-runtime
  [bff]=bff-gateway
  [policy]=policy-service
  [secrets]=secrets-service
  [audit]=audit-service
  [knowledge]=knowledge-service
)

declare -A SERVICE_HEALTH_KEYS=(
  [iam]=iam
  [config]=config
  [mcp]=mcp
  [ai]=ai
  [bff]=bff
  [policy]=policy
  [secrets]=secrets
  [audit]=audit
  [knowledge]=knowledge
)
