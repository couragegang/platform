import os

import pytest
import requests

from lib.chat_assert import expected_chat_status, parse_chat_response
from lib.config import BFF_URL, IAM_URL, KNOWLEDGE_URL, NOTION_TOKEN
from lib.http_client import ApiSession

pytestmark = [pytest.mark.k, pytest.mark.regress]


def _require_legacy_hitl_path() -> None:
    orchestrator = (os.getenv("AI_ORCHESTRATOR") or os.getenv("E2E_AI_ORCHESTRATOR") or "n8n").strip().lower()
    if orchestrator == "n8n":
        pytest.skip("K4 explicit toolName HITL applies to legacy ChatService; n8n uses connector workflows")


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

    def test_bff_me_matches_session(self, session: ApiSession):
        me = session.bff_me()
        assert me.get("userId") == session.user_id
        assert me.get("orgId") == session.org_id


class TestK3Chat:
    def test_bff_chat_stub_reply(self, session: ApiSession):
        body = parse_chat_response(session.bff_chat({"message": "K3 scenario"}))
        assert body["status"] == expected_chat_status()
        if body["status"] == "stub":
            assert "ai-runtime" in body["reply"] or "Заглушка" in body["reply"]
            assert session.workspace_id in body["reply"]
        elif body["status"] == "completed":
            assert "K3 scenario" not in body["reply"] or len(body["reply"]) > 20

    def test_chat_without_tool_skips_policy(self, session: ApiSession):
        body = parse_chat_response(session.bff_chat({"message": "plain chat only"}))
        assert body["status"] in ("stub", "completed", "error")


@pytest.mark.deepseek
class TestK3DeepSeekChat:
    """Запуск вручную: LLM_PROVIDER=deepseek и DEEPSEEK_API_KEY в platform/.env, compose up --build ai."""

    def test_live_deepseek_when_configured(self, session: ApiSession):
        provider = (os.getenv("E2E_LLM_PROVIDER") or os.getenv("LLM_PROVIDER", "")).lower()
        api_key = (os.getenv("DEEPSEEK_API_KEY") or "").strip()
        if provider != "deepseek" or not api_key:
            pytest.skip("Set LLM_PROVIDER=deepseek and DEEPSEEK_API_KEY for live LLM E2E")

        body = parse_chat_response(
            session.bff_chat({"message": "Ответь одним словом: ок"})
        )
        assert body["status"] in ("completed", "error")
        if body["status"] == "completed":
            assert len(body["reply"].strip()) >= 1


class TestK4Hitl:
    def test_pending_approvals_approve(self, session: ApiSession):
        _require_legacy_hitl_path()
        token = NOTION_TOKEN or "ntn_e2e_fake_k4"
        session.install_notion(token, label="K4 HITL")

        body = parse_chat_response(
            session.bff_chat(
                {
                    "message": "update notion page",
                    "toolName": "notion_write_page",
                    "connectorKey": "notion",
                }
            )
        )
        assert body["status"] == "awaiting_approval"
        pending_id = body.get("pendingApprovalId")
        assert pending_id

        listed = requests.get(
            f"{BFF_URL}/api/policy/orgs/{session.org_id}/pending-approvals",
            headers=session.auth_headers(),
            params={"workspace_id": session.workspace_id},
            timeout=30,
        )
        listed.raise_for_status()
        assert any(p["id"] == pending_id for p in listed.json().get("items", []))

        approved = requests.post(
            f"{BFF_URL}/api/policy/pending-approvals/{pending_id}/approve",
            headers=session.auth_headers(),
            json={"decidedByUserId": session.user_id},
            timeout=30,
        )
        approved.raise_for_status()
        assert approved.json()["status"] == "approved"

    def test_pending_approvals_reject(self, session: ApiSession):
        _require_legacy_hitl_path()
        token = NOTION_TOKEN or "ntn_e2e_fake_k4_reject"
        session.install_notion(token, label="K4 HITL reject")

        body = parse_chat_response(
            session.bff_chat(
                {
                    "message": "reject flow",
                    "toolName": "notion_write_page",
                    "connectorKey": "notion",
                }
            )
        )
        assert body["status"] == "awaiting_approval"
        pending_id = body["pendingApprovalId"]

        rejected = requests.post(
            f"{BFF_URL}/api/policy/pending-approvals/{pending_id}/reject",
            headers=session.auth_headers(),
            json={"decidedByUserId": session.user_id},
            timeout=30,
        )
        rejected.raise_for_status()
        assert rejected.json()["status"] == "rejected"

        detail = requests.get(
            f"{BFF_URL}/api/policy/pending-approvals/{pending_id}",
            headers=session.auth_headers(),
            timeout=30,
        )
        detail.raise_for_status()
        assert detail.json()["status"] == "rejected"


class TestK5McpInstall:
    def test_catalog_contains_notion(self, session: ApiSession):
        cat = requests.get(
            f"{BFF_URL}/api/mcp/catalog",
            headers=session.auth_headers(),
            timeout=30,
        )
        cat.raise_for_status()
        items = cat.json().get("items") or []
        assert any(i.get("connectorKey") == "notion" for i in items)

    def test_install_via_bff_and_mcp(self, session: ApiSession):
        token = NOTION_TOKEN or "ntn_e2e_fake_k5"
        inst = session.install_notion(token, label="K5 via MCP")
        assert inst["id"]
        assert inst["connectorKey"] == "notion"


class TestK6InstallationsList:
    def test_list_after_install(self, session: ApiSession):
        token = NOTION_TOKEN or "ntn_e2e_fake_k6"
        inst = session.install_notion(token, label="K6")
        items = session.list_installations()
        assert any(x["connectorKey"] == "notion" for x in items)
        session.delete_installation(inst["id"])


class TestK7Knowledge:
    def test_bff_connectors_and_search(self, session: ApiSession):
        connectors = requests.get(
            f"{BFF_URL}/api/knowledge/connectors",
            headers=session.auth_headers(),
            timeout=30,
        )
        connectors.raise_for_status()
        assert any(c["connectorKey"] == "notion" for c in connectors.json()["items"])

        requests.post(
            f"{BFF_URL}/api/knowledge/workspaces/{session.workspace_id}/sources",
            headers=session.auth_headers(),
            json={"connectorKey": "notion", "displayName": "K7 Search Corpus"},
            timeout=30,
        ).raise_for_status()

        r = requests.post(
            f"{BFF_URL}/api/knowledge/search",
            headers=session.auth_headers(),
            json={
                "orgId": session.org_id,
                "workspaceId": session.workspace_id,
                "query": "Search",
            },
            timeout=30,
        )
        r.raise_for_status()
        assert r.json().get("items")


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
