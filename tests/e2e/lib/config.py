import os
from pathlib import Path

import lib.dotenv_loader  # noqa: F401 — loads platform/.env

PLATFORM_ROOT = Path(__file__).resolve().parents[3]

IAM_URL = os.getenv("E2E_IAM_URL", "http://localhost:8080/v1/iam")
BFF_URL = os.getenv("E2E_BFF_URL", "http://localhost:8082/v1/bff")
MCP_URL = os.getenv("E2E_MCP_URL", "http://localhost:8081/v1/mcp")
AI_URL = os.getenv("E2E_AI_URL", "http://localhost:8083/v1/ai")
CONFIG_URL = os.getenv("E2E_CONFIG_URL", "http://localhost:8084/v1/config")
POLICY_URL = os.getenv("E2E_POLICY_URL", "http://localhost:8085/v1/policy")
AUDIT_URL = os.getenv("E2E_AUDIT_URL", "http://localhost:8086/v1/audit")
SECRETS_URL = os.getenv("E2E_SECRETS_URL", "http://localhost:8087/v1/secrets")

E2E_PASSWORD = os.getenv("E2E_PASSWORD", "E2eTest-Password-1")
NOTION_TOKEN = os.getenv("NOTION_E2E_TOKEN") or os.getenv("NOTION_SMOKE_TOKEN")
DOCKER_VERIFY = os.getenv("E2E_DB_VERIFY", "1") != "0"
COMPOSE_PROJECT = os.getenv("COMPOSE_PROJECT_NAME", "platform")

SERVICES_HEALTH = {
    "iam": f"{IAM_URL}/health",
    "bff": f"{BFF_URL}/health",
    "mcp": f"{MCP_URL}/health",
    "ai": f"{AI_URL}/health",
    "config": f"{CONFIG_URL}/health",
    "policy": f"{POLICY_URL}/health",
    "audit": f"{AUDIT_URL}/health",
    "secrets": f"{SECRETS_URL}/health",
}
