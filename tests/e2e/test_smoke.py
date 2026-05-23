"""Быстрый smoke: register → BFF → catalog → chat (+ knowledge connectors).

Health — в test_health.py (тоже marker smoke).
Запуск: pytest -m smoke
Соответствует platform/scripts/smoke-test.ps1
"""

import pytest
import requests

from lib.chat_assert import expected_chat_status, parse_chat_response
from lib.config import BFF_URL
from lib.http_client import ApiSession

pytestmark = [pytest.mark.smoke, pytest.mark.phase1]


def test_smoke_register_bff_catalog_chat(session: ApiSession):
    me = session.bff_me()
    assert me.get("userId") == session.user_id
    assert me.get("orgId") == session.org_id

    cat = requests.get(
        f"{BFF_URL}/api/mcp/catalog",
        headers=session.auth_headers(),
        timeout=30,
    )
    cat.raise_for_status()
    items = cat.json().get("items") or []
    assert len(items) >= 1
    assert any(i.get("connectorKey") == "notion" for i in items)

    body = parse_chat_response(
        session.bff_chat({"message": "hello smoke pytest"})
    )
    assert body["status"] == expected_chat_status()


def test_smoke_knowledge_connectors(session: ApiSession):
    r = requests.get(
        f"{BFF_URL}/api/knowledge/connectors",
        headers=session.auth_headers(),
        timeout=30,
    )
    r.raise_for_status()
    items = r.json().get("items") or []
    assert any(c.get("connectorKey") == "notion" for c in items)
