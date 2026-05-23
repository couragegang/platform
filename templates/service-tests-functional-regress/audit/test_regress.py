"""Audit regress: tool-events journal."""

import pytest
import requests

from lib.config import AUDIT_URL

pytestmark = pytest.mark.regress


def test_tool_events_list(api_session):
    r = requests.get(
        f"{AUDIT_URL}/orgs/{api_session.org_id}/tool-events",
        headers=api_session.auth_headers(),
        timeout=30,
    )
    r.raise_for_status()
    assert isinstance(r.json(), (list, dict))
