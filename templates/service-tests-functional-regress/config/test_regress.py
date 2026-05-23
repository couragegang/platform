"""Config regress: workspaces via BFF proxy."""

import pytest
import requests

from lib.config import BFF_URL

pytestmark = pytest.mark.regress


def test_list_workspaces_via_bff(api_session):
    r = requests.get(
        f"{BFF_URL}/api/config/orgs/{api_session.org_id}/workspaces",
        headers=api_session.auth_headers(),
        timeout=30,
    )
    r.raise_for_status()
    body = r.json()
    assert "items" in body or isinstance(body, list)
