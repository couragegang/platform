import uuid

import pytest
import requests

from lib.chat_assert import expected_chat_status, parse_chat_response
from lib.config import BFF_URL, IAM_URL, MCP_URL, NOTION_TOKEN
from lib.db_verify import audit_install_events, mcp_installation_row, policy_rules_count
from lib.http_client import ApiSession

pytestmark = pytest.mark.phase1


def test_register_creates_org_and_default_workspace(session: ApiSession):
    assert session.org_id
    assert session.workspace_id
    assert session.default_group_id
    org = requests.get(
        f"{IAM_URL}/organizations/{session.org_id}",
        headers=session.auth_headers(),
        timeout=30,
    ).json()
    assert org["defaultGroupId"] == session.default_group_id


def test_login_and_refresh(session: ApiSession):
    other = ApiSession()
    other.email = session.email
    other.password = session.password
    other.login()
    assert other.access_token
    if other.refresh_token:
        other.refresh()
        assert other.access_token


def test_bff_catalog_and_chat(session: ApiSession):
    me = session.bff_me()
    assert me.get("userId") == session.user_id
    assert me.get("orgId") == session.org_id

    cat = requests.get(
        f"{BFF_URL}/api/mcp/catalog",
        headers=session.auth_headers(),
        timeout=30,
    )
    cat.raise_for_status()
    items = cat.json().get("items") or []
    assert any(i.get("connectorKey") == "notion" for i in items)

    body = parse_chat_response(session.bff_chat({"message": "e2e ping"}))
    assert body["status"] == expected_chat_status()
    assert body.get("reply")


def test_mcp_install_lifecycle(session: ApiSession):
    token = NOTION_TOKEN or f"ntn_e2e_fake_{uuid.uuid4().hex}"
    inst = session.install_notion(token)
    assert inst["connectorKey"] == "notion"
    assert inst["status"] in ("active", "error")

    items = session.list_installations()
    assert any(i["id"] == inst["id"] for i in items)

    dup = requests.post(
        f"{MCP_URL}/workspaces/{session.workspace_id}/installations",
        headers=session.mcp_headers(),
        json={
            "connectorKey": "notion",
            "displayLabel": "dup",
            "form": {"integration_token": token},
        },
        timeout=30,
    )
    assert dup.status_code == 409

    session.delete_installation(inst["id"])
    after = session.list_installations()
    assert not any(i["id"] == inst["id"] for i in after)


@pytest.mark.db
def test_install_persists_secrets_policy_audit(session: ApiSession, db_verify_enabled):
    token = NOTION_TOKEN or f"ntn_e2e_fake_{uuid.uuid4().hex}"
    inst = session.install_notion(token, label="DB verify")
    inst_id = inst["id"]

    row = mcp_installation_row(inst_id)
    assert row is not None
    assert "integration_token" not in row["connection_config"]
    assert row["credential_secret_ref"].startswith("secrets:")

    assert policy_rules_count(inst_id) >= 2

    session.delete_installation(inst_id)
    assert audit_install_events(inst_id) >= 1
