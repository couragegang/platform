"""BFF regress: me, MCP catalog, chat stub."""

import pytest
import requests

from lib.chat_assert import expected_chat_status, parse_chat_response
from lib.config import BFF_URL

pytestmark = pytest.mark.regress


def test_bff_me_catalog_chat(api_session):
    me = api_session.bff_me()
    assert me.get("orgId") == api_session.org_id

    cat = requests.get(
        f"{BFF_URL}/api/mcp/catalog",
        headers=api_session.auth_headers(),
        timeout=30,
    )
    cat.raise_for_status()
    assert len(cat.json().get("items") or []) >= 1

    body = parse_chat_response(
        api_session.bff_chat({"message": "regress bff pytest"})
    )
    assert body["status"] == expected_chat_status()
