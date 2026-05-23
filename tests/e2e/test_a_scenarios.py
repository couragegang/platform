import uuid

import pytest
import requests

from lib.config import AUDIT_URL, BFF_URL, IAM_URL, KNOWLEDGE_URL, NOTION_TOKEN, POLICY_URL
from lib.http_client import ApiSession

pytestmark = pytest.mark.a


class TestA1Members:
    def test_list_members(self, session: ApiSession):
        r = requests.get(
            f"{IAM_URL}/organizations/{session.org_id}/members",
            headers=session.auth_headers(),
            timeout=30,
        )
        r.raise_for_status()
        page = r.json()
        assert page["items"]
        assert any(m["userId"] == session.user_id for m in page["items"])


class TestA2Invites:
    def test_create_and_list_invite(self, session: ApiSession):
        invite_email = f"invite-{uuid.uuid4().hex[:8]}@example.com"
        created = requests.post(
            f"{IAM_URL}/organizations/{session.org_id}/invites",
            headers=session.auth_headers(),
            json={
                "email": invite_email,
                "roleKeys": ["member"],
                "ttlHours": 24,
            },
            timeout=30,
        )
        created.raise_for_status()
        assert created.json()["email"] == invite_email.lower()

        listed = requests.get(
            f"{IAM_URL}/organizations/{session.org_id}/invites",
            headers=session.auth_headers(),
            timeout=30,
        ).json()
        assert any(i["email"] == invite_email.lower() for i in listed.get("items", []))


class TestA3Groups:
    def test_create_group(self, session: ApiSession):
        slug = f"team-{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{IAM_URL}/organizations/{session.org_id}/groups",
            headers=session.auth_headers(),
            json={"name": "E2E Team", "slug": slug},
            timeout=30,
        )
        r.raise_for_status()
        assert r.json()["slug"] == slug


class TestA4Workspaces:
    def test_create_workspace_in_group(self, session: ApiSession):
        slug = f"ws-{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{BFF_URL}/api/config/orgs/{session.org_id}/workspaces",
            headers=session.auth_headers(),
            json={
                "name": "E2E Workspace",
                "slug": slug,
                "groupId": session.default_group_id,
            },
            timeout=30,
        )
        r.raise_for_status()
        assert r.json()["slug"] == slug

    def test_bff_list_workspaces(self, session: ApiSession):
        r = requests.get(
            f"{BFF_URL}/api/config/orgs/{session.org_id}/workspaces",
            headers=session.auth_headers(),
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items") or []
        assert items
        assert any(ws.get("id") == session.workspace_id for ws in items)


class TestA5Policy:
    def test_list_rules_direct(self, session: ApiSession):
        if NOTION_TOKEN:
            session.install_notion(NOTION_TOKEN, label="A5 policy rules")
        r = requests.get(
            f"{POLICY_URL}/orgs/{session.org_id}/rules",
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        if NOTION_TOKEN:
            assert len(items) >= 2

    def test_bff_list_rules(self, session: ApiSession):
        if NOTION_TOKEN:
            session.install_notion(NOTION_TOKEN, label="A5 BFF rules")
        r = requests.get(
            f"{BFF_URL}/api/policy/orgs/{session.org_id}/rules",
            headers=session.auth_headers(),
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        if NOTION_TOKEN:
            assert len(items) >= 2
        assert all("effect" in rule for rule in items) or not items


class TestA7SsoNotImplemented:
    """Enterprise SSO — заглушка 501 (MVP)."""

    def test_sso_start_returns_501(self, session: ApiSession):
        r = requests.get(
            f"{IAM_URL}/auth/sso/e2e-org/start",
            headers=session.auth_headers(),
            timeout=30,
        )
        assert r.status_code == 501


@pytest.mark.skip(reason="A8: billing-service not implemented")
class TestA8Billing:
    def test_plans(self):
        pass


class TestA6Audit:
    def test_tool_events_direct(self, session: ApiSession):
        token = NOTION_TOKEN or "ntn_e2e_fake"
        inst = session.install_notion(token, label="A6 audit")
        r = requests.get(
            f"{AUDIT_URL}/orgs/{session.org_id}/tool-events",
            params={"workspace_id": session.workspace_id},
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        assert any(e.get("installationId") == inst["id"] for e in items)

    def test_bff_tool_events(self, session: ApiSession):
        token = NOTION_TOKEN or "ntn_e2e_fake_bff_audit"
        inst = session.install_notion(token, label="A6 BFF audit")
        r = requests.get(
            f"{BFF_URL}/api/audit/orgs/{session.org_id}/tool-events",
            headers=session.auth_headers(),
            params={"workspace_id": session.workspace_id},
            timeout=30,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        assert any(e.get("installationId") == inst["id"] for e in items)


class TestA9Knowledge:
    def test_sources_and_reindex(self, session: ApiSession):
        connectors = requests.get(f"{KNOWLEDGE_URL}/connectors", timeout=30)
        connectors.raise_for_status()
        assert any(c["connectorKey"] == "notion" for c in connectors.json()["items"])

        created = requests.post(
            f"{KNOWLEDGE_URL}/workspaces/{session.workspace_id}/sources",
            params={"org_id": session.org_id},
            json={
                "connectorKey": "notion",
                "displayName": "E2E Notion KB",
            },
            timeout=30,
        )
        created.raise_for_status()
        source = created.json()
        assert source["connectorKey"] == "notion"
        source_id = source["id"]

        reindex = requests.post(
            f"{KNOWLEDGE_URL}/sources/{source_id}/reindex",
            timeout=30,
        )
        reindex.raise_for_status()
        assert reindex.json().get("documentsIndexed", 0) >= 0

    def test_bff_sources_and_reindex(self, session: ApiSession):
        listed = requests.get(
            f"{BFF_URL}/api/knowledge/workspaces/{session.workspace_id}/sources",
            headers=session.auth_headers(),
            timeout=30,
        )
        listed.raise_for_status()

        created = requests.post(
            f"{BFF_URL}/api/knowledge/workspaces/{session.workspace_id}/sources",
            headers=session.auth_headers(),
            json={"connectorKey": "notion", "displayName": "A9 BFF KB"},
            timeout=30,
        )
        created.raise_for_status()
        source_id = created.json()["id"]

        reindex = requests.post(
            f"{BFF_URL}/api/knowledge/sources/{source_id}/reindex",
            headers=session.auth_headers(),
            json={},
            timeout=30,
        )
        reindex.raise_for_status()
