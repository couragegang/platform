import uuid

import pytest
import requests

from lib.config import CONFIG_URL, IAM_URL
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
                "groupId": None,
                "groupRoleKeys": None,
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
            f"{CONFIG_URL}/orgs/{session.org_id}/workspaces",
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


@pytest.mark.skip(reason="A5: policy rules public API not implemented")
class TestA5Policy:
    def test_list_rules(self):
        pass


@pytest.mark.skip(reason="A6: audit read API not implemented")
class TestA6Audit:
    def test_tool_events(self):
        pass


@pytest.mark.skip(reason="A7: Enterprise SSO out of MVP scope")
class TestA7Idp:
    def test_sso(self):
        pass


@pytest.mark.skip(reason="A8: billing-service not implemented")
class TestA8Billing:
    def test_plans(self):
        pass


@pytest.mark.skip(reason="A9: knowledge-service not implemented")
class TestA9Knowledge:
    def test_sources(self):
        pass
