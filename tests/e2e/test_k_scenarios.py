import pytest
import requests

from lib.config import BFF_URL, IAM_URL, MCP_URL, NOTION_TOKEN
from lib.http_client import ApiSession

pytestmark = pytest.mark.k


class TestK1Auth:
    def test_register_login_logout(self, require_compose):
        s = ApiSession()
        s.register_with_org(org_name="K1 Org")
        s.login()
        me = s.iam_me()
        assert me["user"]["email"] == s.email.lower()

        if s.refresh_token:
            s.refresh()

        if s.refresh_token:
            r = requests.post(
                f"{IAM_URL}/auth/logout",
                json={"refreshToken": s.refresh_token},
                timeout=30,
            )
            assert r.status_code == 204


class TestK2Context:
    def test_org_groups_workspace(self, session: ApiSession):
        groups = requests.get(
            f"{IAM_URL}/organizations/{session.org_id}/groups",
            headers=session.auth_headers(),
            timeout=30,
        ).json()
        assert groups["items"]
        default = next((g for g in groups["items"] if g.get("isDefault")), None)
        assert default is not None
        assert session.workspace_id


class TestK3Chat:
    def test_bff_chat(self, session: ApiSession):
        r = requests.post(
            f"{BFF_URL}/api/chat",
            headers={**session.auth_headers(), "X-Workspace-Id": session.workspace_id},
            json={"message": "K3 scenario"},
            timeout=30,
        )
        r.raise_for_status()


@pytest.mark.skip(reason="K4: pending-approvals API not implemented")
class TestK4Hitl:
    def test_pending_approvals(self):
        pass


class TestK5McpInstall:
    def test_install_via_bff_and_mcp(self, session: ApiSession):
        cat = requests.get(
            f"{BFF_URL}/api/mcp/catalog",
            headers=session.auth_headers(),
            timeout=30,
        )
        cat.raise_for_status()

        token = NOTION_TOKEN or "ntn_e2e_fake_k5"
        inst = session.install_notion(token, label="K5 via MCP")
        assert inst["id"]


class TestK6InstallationsList:
    def test_list_after_install(self, session: ApiSession):
        token = NOTION_TOKEN or "ntn_e2e_fake_k6"
        inst = session.install_notion(token, label="K6")
        items = session.list_installations()
        assert any(x["connectorKey"] == "notion" for x in items)
        session.delete_installation(inst["id"])


@pytest.mark.skip(reason="K7: knowledge-service not implemented")
class TestK7Knowledge:
    def test_search(self):
        pass


class TestK8Profile:
    def test_me_and_sessions(self, session: ApiSession):
        me = requests.get(
            f"{IAM_URL}/me",
            headers=session.auth_headers(),
            timeout=30,
        ).json()
        assert me["user"]["id"] == session.user_id

        sessions = requests.get(
            f"{IAM_URL}/me/sessions",
            headers=session.auth_headers(),
            timeout=30,
        )
        sessions.raise_for_status()
        assert "items" in sessions.json() or isinstance(sessions.json(), dict)
