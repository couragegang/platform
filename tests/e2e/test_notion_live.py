import pytest
import requests

from lib.config import MCP_URL
from lib.http_client import ApiSession

pytestmark = [pytest.mark.phase1, pytest.mark.notion, pytest.mark.k]


@pytest.fixture
def require_notion_token(notion_token):
    if not notion_token:
        pytest.skip("Set NOTION_E2E_TOKEN or NOTION_SMOKE_TOKEN for live Notion tests")


def test_notion_install_and_health_ok(session: ApiSession, require_notion_token, notion_token):
    inst = session.install_notion(notion_token, label="Live Notion")
    try:
        r = requests.post(
            f"{MCP_URL}/workspaces/{session.workspace_id}/installations/{inst['id']}/health",
            headers=session.mcp_headers(),
            timeout=60,
        )
        r.raise_for_status()
        body = r.json()
        assert body["ok"] is True, body.get("message")
        assert inst["status"] == "active" or r.json()["ok"]
    finally:
        session.delete_installation(inst["id"])
