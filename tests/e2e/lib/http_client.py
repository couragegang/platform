import uuid
from typing import Any

import requests

from .config import BFF_URL, CONFIG_URL, E2E_PASSWORD, IAM_URL, MCP_URL


class ApiSession:
    def __init__(self) -> None:
        self.email = f"e2e-{uuid.uuid4().hex[:12]}@example.com"
        self.password = E2E_PASSWORD
        self.access_token: str | None = None
        self.refresh_token: str | None = None
        self.user_id: str | None = None
        self.org_id: str | None = None
        self.default_group_id: str | None = None
        self.workspace_id: str | None = None

    def auth_headers(self) -> dict[str, str]:
        assert self.access_token
        return {"Authorization": f"Bearer {self.access_token}"}

    def register_with_org(self, org_name: str = "E2E Org") -> dict[str, Any]:
        r = requests.post(
            f"{IAM_URL}/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "displayName": "E2E User",
                "organizationName": org_name,
            },
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        self.access_token = data["accessToken"]
        self.refresh_token = data.get("refreshToken")
        return data

    def login(self) -> dict[str, Any]:
        r = requests.post(
            f"{IAM_URL}/auth/login",
            json={"email": self.email, "password": self.password},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        self.access_token = data["accessToken"]
        self.refresh_token = data.get("refreshToken")
        return data

    def refresh(self) -> dict[str, Any]:
        assert self.refresh_token
        r = requests.post(
            f"{IAM_URL}/auth/refresh",
            json={"refreshToken": self.refresh_token},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()
        self.access_token = data["accessToken"]
        self.refresh_token = data.get("refreshToken", self.refresh_token)
        return data

    def iam_me(self) -> dict[str, Any]:
        r = requests.get(f"{IAM_URL}/me", headers=self.auth_headers(), timeout=30)
        r.raise_for_status()
        return r.json()

    def resolve_org_and_workspace(self) -> None:
        me = self.iam_me()
        self.user_id = me["user"]["id"]
        orgs = me.get("organizations") or []
        assert orgs, "expected at least one org after register"
        org = orgs[0]
        self.org_id = str(org.get("orgId") or org.get("id"))
        r = requests.get(
            f"{IAM_URL}/organizations/{self.org_id}",
            headers=self.auth_headers(),
            timeout=30,
        )
        r.raise_for_status()
        org_detail = r.json()
        self.default_group_id = org_detail.get("defaultGroupId")
        ws = requests.get(
            f"{CONFIG_URL}/orgs/{self.org_id}/workspaces",
            headers=self.auth_headers(),
            timeout=30,
        )
        ws.raise_for_status()
        items = ws.json().get("items") or []
        assert items, "default workspace missing after bootstrap"
        self.workspace_id = items[0]["id"]

    def bff_me(self) -> dict[str, Any]:
        r = requests.get(f"{BFF_URL}/api/me", headers=self.auth_headers(), timeout=30)
        r.raise_for_status()
        return r.json()

    def mcp_headers(self) -> dict[str, str]:
        h = self.auth_headers()
        assert self.org_id and self.user_id
        h["X-Org-Id"] = self.org_id
        h["X-User-Id"] = self.user_id
        return h

    def install_notion(self, token: str, label: str = "Notion E2E") -> dict[str, Any]:
        assert self.workspace_id
        r = requests.post(
            f"{MCP_URL}/workspaces/{self.workspace_id}/installations",
            headers=self.mcp_headers(),
            json={
                "connectorKey": "notion",
                "displayLabel": label,
                "form": {"integration_token": token},
            },
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

    def list_installations(self) -> list[dict[str, Any]]:
        assert self.workspace_id
        r = requests.get(
            f"{MCP_URL}/workspaces/{self.workspace_id}/installations",
            headers=self.mcp_headers(),
            timeout=30,
        )
        r.raise_for_status()
        return r.json().get("items") or []

    def delete_installation(self, installation_id: str) -> None:
        assert self.workspace_id
        r = requests.delete(
            f"{MCP_URL}/workspaces/{self.workspace_id}/installations/{installation_id}",
            headers=self.mcp_headers(),
            timeout=30,
        )
        r.raise_for_status()
