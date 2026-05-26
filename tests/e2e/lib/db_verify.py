import json
import subprocess
from typing import Any

from .config import DOCKER_VERIFY, PLATFORM_ROOT


def _compose_exec_psql(database: str, sql: str) -> str:
    cmd = [
        "docker",
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "platform",
        "-d",
        database,
        "-t",
        "-A",
        "-c",
        sql,
    ]
    result = subprocess.run(
        cmd,
        cwd=str(PLATFORM_ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def db_available() -> bool:
    if not DOCKER_VERIFY:
        return False
    try:
        _compose_exec_psql("platform", "SELECT 1")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def mcp_installation_row(installation_id: str) -> dict[str, Any] | None:
    raw = _compose_exec_psql(
        "mcp",
        f"""
        SELECT connection_config::text, credential_secret_ref
        FROM workspace_mcp_installations
        WHERE id = '{installation_id}'::uuid
        """,
    )
    if not raw:
        return None
    parts = raw.split("|", 1)
    config = json.loads(parts[0]) if parts[0] else {}
    if config is None:
        config = {}
    secret_ref = parts[1] if len(parts) > 1 else ""
    return {"connection_config": config, "credential_secret_ref": secret_ref}


def policy_rules_count(installation_id: str) -> int:
    raw = _compose_exec_psql(
        "policy",
        f"""
        SELECT COUNT(*) FROM policy_rules
        WHERE installation_id = '{installation_id}'::uuid AND source = 'install_pack'
        """,
    )
    return int(raw or "0")


def audit_install_events(installation_id: str) -> int:
    raw = _compose_exec_psql(
        "audit",
        f"""
        SELECT COUNT(*) FROM tool_audit_events
        WHERE installation_id = '{installation_id}'::uuid
          AND event_type = 'mcp.installation'
        """,
    )
    return int(raw or "0")
