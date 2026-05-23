"""Knowledge regress: connectors via BFF."""

import pytest
import requests

from lib.config import BFF_URL

pytestmark = pytest.mark.regress


def test_knowledge_connectors(api_session):
    r = requests.get(
        f"{BFF_URL}/api/knowledge/connectors",
        headers=api_session.auth_headers(),
        timeout=30,
    )
    r.raise_for_status()
    items = r.json().get("items") or []
    assert isinstance(items, list)
