"""AI regress: health + stub chat via BFF."""

import pytest

from lib.chat_assert import expected_chat_status, parse_chat_response

pytestmark = pytest.mark.regress


def test_ai_chat_via_bff(api_session):
    body = parse_chat_response(
        api_session.bff_chat({"message": "regress ai pytest"})
    )
    assert body["status"] == expected_chat_status()
